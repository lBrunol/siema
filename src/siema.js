/**
 * Hi :-) This is a class representing a Siema.
 */
export default class Siema {
  /**
   * Create a Siema.
   * @param {Object} options - Optional settings object.
   */
  constructor(options) {
    // Merge defaults with user's settings
    this.config = Siema.mergeSettings(options);

    // Create global references
    this.selector = typeof this.config.selector === 'string' ? document.querySelector(this.config.selector) : this.config.selector;
    this.selectorWidth = this.selector.offsetWidth;
    this.innerElements = [].slice.call(this.selector.children);
    this.currentSlide = this.config.startIndex;
    this.transformProperty = Siema.webkitOrNot();
    this.pagination = null;
    this.navigation = null;
    this.autoPlayTime = 4000;
    this.autoPlayInterval = null;

    // Bind all event handlers for referencability
    ['resizeHandler', 'touchstartHandler', 'touchendHandler', 'touchmoveHandler', 'mousedownHandler', 'mouseupHandler', 'mouseleaveHandler', 'mousemoveHandler'].forEach(method => {
      this[method] = this[method].bind(this);
    });

    // Build markup and apply required styling to elements
    this.init();
  }


  /**
   * Overrides default settings with custom ones.
   * @param {Object} options - Optional settings object.
   * @returns {Object} - Custom Siema settings.
   */
  static mergeSettings(options) {
    const settings = {
      selector: '.siema',
      duration: 200,
      easing: 'ease-out',
      perPage: 1,
      startIndex: 0,
      draggable: true,
      threshold: 20,
      loop: false,
      autoPlay: false,
      navigation: false,
      pagination: false,
      onInit: () => {},
      onChange: () => {},
    };

    const userSttings = options;
    for (const attrname in userSttings) {
      settings[attrname] = userSttings[attrname];
    }

    return settings;
  }


  /**
   * Determine if browser supports unprefixed transform property.
   * @returns {string} - Transform property supported by client.
   */
  static webkitOrNot() {
    const style = document.documentElement.style;
    if (typeof style.transform === 'string') {
      return 'transform';
    }
    return 'WebkitTransform';
  }


  /**
   * Builds the markup and attaches listeners to required events.
   */
  init() {
    // Resize element on window resize
    window.addEventListener('resize', this.resizeHandler);

    // If element is draggable / swipable, add event handlers
    if (this.config.draggable) {
      // Keep track pointer hold and dragging distance
      this.pointerDown = false;
      this.drag = {
        startX: 0,
        endX: 0,
        startY: 0,
        letItGo: null
      };

      //Container of slider frame
      this.outerFrame = document.createElement('div');

      // Touch events
      this.outerFrame.addEventListener('touchstart', this.touchstartHandler, { passive: true });
      this.outerFrame.addEventListener('touchend', this.touchendHandler);
      this.outerFrame.addEventListener('touchmove', this.touchmoveHandler, { passive: true });

      // Mouse events
      this.outerFrame.addEventListener('mousedown', this.mousedownHandler);
      this.outerFrame.addEventListener('mouseup', this.mouseupHandler);
      this.outerFrame.addEventListener('mouseleave', this.mouseleaveHandler);
      this.outerFrame.addEventListener('mousemove', this.mousemoveHandler);
    }

    if (this.selector === null) {
      throw new Error('Something wrong with your selector 😭');
    }

    // update perPage number dependable of user value
    this.resolveSlidesNumber();

    // hide everything out of selector's boundaries
    this.outerFrame.style.overflow = 'hidden';

    // Create frame and apply styling
    this.sliderFrame = document.createElement('div');
    this.sliderFrame.style.width = `${(this.selectorWidth / this.perPage) * this.innerElements.length}px`;
    this.sliderFrame.style.webkitTransition = `all ${this.config.duration}ms ${this.config.easing}`;
    this.sliderFrame.style.transition = `all ${this.config.duration}ms ${this.config.easing}`;
    this.sliderFrame.style.willChange = 'transform';

    if (this.config.draggable) {
      this.outerFrame.style.cursor = '-webkit-grab';
    }

    // Create a document fragment to put slides into it
    const docFragment = document.createDocumentFragment();

    // Loop through the slides, add styling and add them to document fragment
    for (let i = 0; i < this.innerElements.length; i++) {
      const elementContainer = document.createElement('div');
      elementContainer.style.cssFloat = 'left';
      elementContainer.style.float = 'left';
      elementContainer.style.width = `${100 / this.innerElements.length}%`;
      elementContainer.appendChild(this.innerElements[i]);
      docFragment.appendChild(elementContainer);
    }

    // Add fragment to the frame
    this.sliderFrame.appendChild(docFragment);

    // Clear selector (just in case something is there) and insert a frame
    this.selector.innerHTML = '';
    this.outerFrame.appendChild(this.sliderFrame);
    this.selector.appendChild(this.outerFrame);

    // Go to currently active slide after initial build
    this.slideToCurrent();

    if(this.config.navigation || typeof this.config.navigation === 'object') {
      this.buildNavigation();
    }

    if(this.config.pagination){
      this.buildPagination();
      this.updateActiveIndexPagination();
    }

    this.play();

    this.config.onInit.call(this);
  }

  /**
   * Starts carousel autoplay
   */
  play(){
    this.stop();
    if(this.config.autoPlay){
      this.resolveAutoPlayTime();

      this.autoPlayInterval = window.setInterval(f => {
        this.next(this.perPage);
        this.updateActiveIndexPagination();
      }, this.autoPlayTime);
    }
  }

  /**
   * Stops carousel autoplay
   *
   */
  stop(){
    if(this.config.autoPlay && this.autoPlayInterval){
      window.clearInterval(this.autoPlayInterval);
    }
  }

  /**
   * Restarts carousel autoplay
   *
   */
  restartAutoPlay(){
    this.stop();
    this.play();
  }

  /**
   * Resolve o tempo de autoplay do carousel. Caso true seja passado na configuração 'autoPlay', o tempo utilizado será de 4000ms.
   * Caso seja passado um inteiro válido maior que 999, este erá assumido para o autoPlay.
   *
   * Resolve carousel autoplay time. Wheither the 'autoPlay' value is true, the time will be 4000ms. Case the value a valid integer
   */
  resolveAutoPlayTime(){
    if(this.config.autoPlay){
      if(!isNaN(parseFloat(this.config.autoPlay) && this.config.autoPlay > 999)){
        this.autoPlayTime = this.config.autoPlay;
      }
    }
  }

  /**
   * Determinates slides number accordingly to clients viewport.
   */
  resolveSlidesNumber() {
    if (typeof this.config.perPage === 'number') {
      this.perPage = this.config.perPage;
    }
    else if (typeof this.config.perPage === 'object') {
      this.perPage = 1;
      for (const viewport in this.config.perPage) {
        if (window.innerWidth >= viewport) {
          this.perPage = this.config.perPage[viewport];
        }
      }
    }
  }


  /**
   * Go to previous slide.
   * @param {number} [howManySlides=1] - How many items to slide backward.
   * @param {function} callback - Optional callback function.
   */
  prev(howManySlides = 1, callback) {
    if (this.innerElements.length <= this.perPage) {
      return;
    }
    const beforeChange = this.currentSlide;
    if (this.currentSlide === 0 && this.config.loop) {
      this.currentSlide = this.innerElements.length - this.perPage;
    }
    else {
      this.currentSlide = Math.max(this.currentSlide - howManySlides, 0);
    }
    if (beforeChange !== this.currentSlide) {
      this.slideToCurrent();
      this.config.onChange.call(this);
      if (callback) {
        callback.call(this);
      }
      this.updateActiveIndexPagination();
      this.restartAutoPlay();
    }
  }


  /**
   * Go to next slide.
   * @param {number} [howManySlides=1] - How many items to slide forward.
   * @param {function} callback - Optional callback function.
   */
  next(howManySlides = 1, callback) {
    if (this.innerElements.length <= this.perPage) {
      return;
    }
    const beforeChange = this.currentSlide;
    if (this.currentSlide === this.innerElements.length - this.perPage && this.config.loop) {
      this.currentSlide = 0;
    }
    else {
      this.currentSlide = Math.min(this.currentSlide + howManySlides, this.innerElements.length - this.perPage);
    }
    if (beforeChange !== this.currentSlide) {
      this.slideToCurrent();
      this.config.onChange.call(this);
      if (callback) {
        callback.call(this);
      }
      this.updateActiveIndexPagination();
      this.restartAutoPlay();
    }
  }


  /**
   * Go to slide with particular index
   * @param {number} index - Item index to slide to.
   * @param {function} callback - Optional callback function.
   */
  goTo(index, callback) {
    if (this.innerElements.length <= this.perPage) {
      return;
    }

    const beforeChange = this.currentSlide;
    this.currentSlide = Math.min(Math.max(index, 0), this.innerElements.length - this.perPage);
    if (beforeChange !== this.currentSlide) {
      this.slideToCurrent();
      this.config.onChange.call(this);
      if (callback) {
        callback.call(this);
      }
      this.updateActiveIndexPagination();
      this.restartAutoPlay();
    }
  }


  /**
   * Moves sliders frame to position of currently active slide
   */
  slideToCurrent() {
    this.sliderFrame.style[this.transformProperty] = `translate3d(-${this.currentSlide * (this.selectorWidth / this.perPage)}px, 0, 0)`;
  }


  /**
   * Recalculate drag /swipe event and reposition the frame of a slider
   */
  updateAfterDrag() {
    const movement = this.drag.endX - this.drag.startX;
    const movementDistance = Math.abs(movement);
    const howManySliderToSlide = Math.ceil(movementDistance / (this.selectorWidth / this.perPage));

    if (movement > 0 && movementDistance > this.config.threshold && this.innerElements.length > this.perPage) {
      this.prev(howManySliderToSlide);
    }
    else if (movement < 0 && movementDistance > this.config.threshold && this.innerElements.length > this.perPage) {
      this.next(howManySliderToSlide);
    }
    this.slideToCurrent();
    this.restartAutoPlay();
  }


  /**
   * When window resizes, resize slider components as well
   */
  resizeHandler() {
    // update perPage number dependable of user value
    this.resolveSlidesNumber();

    this.selectorWidth = this.selector.offsetWidth;
    this.sliderFrame.style.width = `${(this.selectorWidth / this.perPage) * this.innerElements.length}px`;

    this.slideToCurrent();

    setTimeout(f=> {
      this.restartAutoPlay();
      if(this.config.pagination){
        this.destroyPagination();
        this.buildPagination();
      }
      this.updateActiveIndexPagination();
    }, 300);
  }


  /**
   * Clear drag after touchend and mouseup event
   */
  clearDrag() {
    this.drag = {
      startX: 0,
      endX: 0,
      startY: 0,
      letItGo: null
    };
  }


  /**
   * touchstart event handler
   */
  touchstartHandler(e) {
    e.stopPropagation();
    this.pointerDown = true;
    this.drag.startX = e.touches[0].pageX;
    this.drag.startY = e.touches[0].pageY;
  }


  /**
   * touchend event handler
   */
  touchendHandler(e) {
    e.stopPropagation();
    this.pointerDown = false;
    this.sliderFrame.style.webkitTransition = `all ${this.config.duration}ms ${this.config.easing}`;
    this.sliderFrame.style.transition = `all ${this.config.duration}ms ${this.config.easing}`;
    if (this.drag.endX) {
      this.updateAfterDrag();
    }
    this.clearDrag();
  }


  /**
   * touchmove event handler
   */
  touchmoveHandler(e) {
    e.stopPropagation();

    if (this.drag.letItGo === null) {
      this.drag.letItGo = Math.abs(this.drag.startY - e.touches[0].pageY) < Math.abs(this.drag.startX - e.touches[0].pageX);
    }

    if (this.pointerDown && this.drag.letItGo) {
      this.drag.endX = e.touches[0].pageX;
      this.sliderFrame.style.webkitTransition = `all 0ms ${this.config.easing}`;
      this.sliderFrame.style.transition = `all 0ms ${this.config.easing}`;
      this.sliderFrame.style[this.transformProperty] = `translate3d(${(this.currentSlide * (this.selectorWidth / this.perPage) + (this.drag.startX - this.drag.endX)) * -1}px, 0, 0)`;
    }
  }


  /**
   * mousedown event handler
   */
  mousedownHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    this.pointerDown = true;
    this.drag.startX = e.pageX;
  }


  /**
   * mouseup event handler
   */
  mouseupHandler(e) {
    e.stopPropagation();
    this.pointerDown = false;
    this.outerFrame.style.cursor = '-webkit-grab';
    this.sliderFrame.style.webkitTransition = `all ${this.config.duration}ms ${this.config.easing}`;
    this.sliderFrame.style.transition = `all ${this.config.duration}ms ${this.config.easing}`;
    if (this.drag.endX) {
      this.updateAfterDrag();
    }
    this.clearDrag();
  }


  /**
   * mousemove event handler
   */
  mousemoveHandler(e) {
    e.preventDefault();
    if (this.pointerDown) {
      this.drag.endX = e.pageX;
      this.outerFrame.style.cursor = '-webkit-grabbing';
      this.sliderFrame.style.webkitTransition = `all 0ms ${this.config.easing}`;
      this.sliderFrame.style.transition = `all 0ms ${this.config.easing}`;
      this.sliderFrame.style[this.transformProperty] = `translate3d(${(this.currentSlide * (this.selectorWidth / this.perPage) + (this.drag.startX - this.drag.endX)) * -1}px, 0, 0)`;
    }
  }


  /**
   * mouseleave event handler
   */
  mouseleaveHandler(e) {
    if (this.pointerDown) {
      this.pointerDown = false;
      this.outerFrame.style.cursor = '-webkit-grab';
      this.drag.endX = e.pageX;
      this.sliderFrame.style.webkitTransition = `all ${this.config.duration}ms ${this.config.easing}`;
      this.sliderFrame.style.transition = `all ${this.config.duration}ms ${this.config.easing}`;
      this.updateAfterDrag();
      this.clearDrag();
    }
  }


  /**
   * Update after removing, prepending or appending items.
   */
  updateFrame() {
    // Create frame and apply styling
    this.sliderFrame = document.createElement('div');
    this.sliderFrame.style.width = `${(this.selectorWidth / this.perPage) * this.innerElements.length}px`;
    this.sliderFrame.style.webkitTransition = `all ${this.config.duration}ms ${this.config.easing}`;
    this.sliderFrame.style.transition = `all ${this.config.duration}ms ${this.config.easing}`;
    this.sliderFrame.style.willChange = 'transform';

    if (this.config.draggable) {
      this.outerFrame.style.cursor = '-webkit-grab';
    }

    // Create a document fragment to put slides into it
    const docFragment = document.createDocumentFragment();

    // Loop through the slides, add styling and add them to document fragment
    for (let i = 0; i < this.innerElements.length; i++) {
      const elementContainer = document.createElement('div');
      elementContainer.style.cssFloat = 'left';
      elementContainer.style.float = 'left';
      elementContainer.style.width = `${100 / this.innerElements.length}%`;
      elementContainer.appendChild(this.innerElements[i]);
      docFragment.appendChild(elementContainer);
    }

    // Add fragment to the frame
    this.sliderFrame.appendChild(docFragment);

    // Clear selector (just in case something is there) and insert a frame
    this.selector.innerHTML = '';
    this.outerFrame.appendChild(this.sliderFrame);
    this.selector.appendChild(this.outerFrame);

    // Go to currently active slide after initial build
    this.slideToCurrent();
    if(this.config.navigation || typeof this.config.navigation === 'object') {
      this.buildNavigation();
    }

    setTimeout(f=> {
      if(this.config.pagination){
        this.destroyPagination();
        this.buildPagination();
      }
    }, 200);

    this.restartAutoPlay();
  }


  /**
   * Remove item from carousel.
   * @param {number} index - Item index to remove.
   * @param {function} callback - Optional callback to call after remove.
   */
  remove(index, callback) {
    if (index < 0 || index >= this.innerElements.length) {
      throw new Error('Item to remove doesn\'t exist 😭');
    }
    this.innerElements.splice(index, 1);

    // Avoid shifting content
    this.currentSlide = index <= this.currentSlide ? this.currentSlide - 1 : this.currentSlide;

    this.updateFrame();
    if (callback) {
      callback.call(this);
    }
  }


  /**
   * Insert item to carousel at particular index.
   * @param {HTMLElement} item - Item to insert.
   * @param {number} index - Index of new new item insertion.
   * @param {function} callback - Optional callback to call after insert.
   */
  insert(item, index, callback) {
    if (index < 0 || index > this.innerElements.length + 1) {
      throw new Error('Unable to inset it at this index 😭');
    }
    if (this.innerElements.indexOf(item) !== -1) {
      throw new Error('The same item in a carousel? Really? Nope 😭');
    }
    this.innerElements.splice(index, 0, item);

    // Avoid shifting content
    this.currentSlide = index <= this.currentSlide ? this.currentSlide + 1 : this.currentSlide;

    this.updateFrame();
    if (callback) {
      callback.call(this);
    }
  }


  /**
   * Prepend item to carousel.
   * @param {HTMLElement} item - Item to prepend.
   * @param {function} callback - Optional callback to call after prepend.
   */
  prepend(item, callback) {
    this.insert(item, 0);
    if (callback) {
      callback.call(this);
    }
  }


  /**
   * Append item to carousel.
   * @param {HTMLElement} item - Item to append.
   * @param {function} callback - Optional callback to call after append.
   */
  append(item, callback) {
    this.insert(item, this.innerElements.length + 1);
    if (callback) {
      callback.call(this);
    }
  }


  /**
   * Removes listeners and optionally restores to initial markup
   * @param {boolean} restoreMarkup - Determinants about restoring an initial markup.
   * @param {function} callback - Optional callback function.
   */
  destroy(restoreMarkup = false, callback) {
    window.removeEventListener('resize', this.resizeHandler);
    this.outerFrame.style.cursor = 'auto';
    this.outerFrame.removeEventListener('touchstart', this.touchstartHandler);
    this.outerFrame.removeEventListener('touchend', this.touchendHandler);
    this.outerFrame.removeEventListener('touchmove', this.touchmoveHandler);
    this.outerFrame.removeEventListener('mousedown', this.mousedownHandler);
    this.outerFrame.removeEventListener('mouseup', this.mouseupHandler);
    this.outerFrame.removeEventListener('mouseleave', this.mouseleaveHandler);
    this.outerFrame.removeEventListener('mousemove', this.mousemoveHandler);

    this.stop();

    if (restoreMarkup) {
      const slides = document.createDocumentFragment();
      for (let i = 0; i < this.innerElements.length; i++) {
        slides.appendChild(this.innerElements[i]);
      }
      this.selector.innerHTML = '';
      this.selector.appendChild(slides);
      this.selector.removeAttribute('style');
    }

    if (callback) {
      callback.call(this);
    }
  }

  /**
   * Destrói a paginação
   *
   */
  destroyPagination(){
    this.selector.removeChild(this.pagination);
    this.pagination = null;
  }

  /**
   * Constrói a paginação
   *
   */
  buildPagination(){
    let containerPagination = document.createElement('div');
    let paginationAmount = Math.ceil(this.innerElements.length / this.perPage);
    let paginationList = document.createElement('ol');

    for(let i = 0; i < paginationAmount; i++){
      let item = document.createElement('li');
      let button = document.createElement('button');
      item.classList.add('item');
      button.type = 'button';
      button.classList.add('button');
      item.appendChild(button);
      button.addEventListener('click', (e) => {
        this.goTo.call(this, this.resolvePaginationSlideTarget(e.srcElement.parentElement))
      });
      paginationList.appendChild(item);
    }

    paginationList.classList.add('siema-paginationlist');
    containerPagination.classList.add('siema-pagination');
    containerPagination.appendChild(paginationList);
    this.selector.appendChild(containerPagination);

    this.pagination = containerPagination;
  }

  /**
   * Atualiza o índice atual da paginação
   *
   */
  updateActiveIndexPagination(){
    if(this.config.pagination && this.pagination){
      let activeIndexPagination = Math.floor(this.currentSlide / this.perPage);
      let items = this.pagination.querySelector('.siema-paginationlist').children;

      this.removeActiveClassPagination();
      items[activeIndexPagination].querySelector('button').classList.add('-active');
    }
  }

  /**
   * Removes '-active' class from buttons of the pagination
   *
   */
  removeActiveClassPagination(){
    if(this.config.pagination && this.pagination){
      let buttons = this.pagination.querySelectorAll('.siema-paginationlist .button');
      if(buttons.length > 0){
        buttons.forEach((item) => {
          item.classList.remove('-active');
        });
      }
    }
  }

  /**
   * Returns the pagination target index
   *
   * @param {HTMLElement} el
   * @returns {number}
   */
  resolvePaginationSlideTarget(el){
    return this.perPage * this.getElementIndex(el);
  }

  /**
   * Get the element index
   *
   * @param {HTMLElement} el element to discover
   * @returns {number} Element index
   */
  getElementIndex(el){
    let index = 0;
    let len = 1;
    let parent = el.parentElement;

    if(parent){
      len = parent.children.length;
    }

    while(el.nextElementSibling){
      el = el.nextElementSibling;
      index++;
    }

    return len - index - 1;
  }

  /**
   * Appends the navigation to carousel.
   *
   */
  buildNavigation(){
    const nextElement = this.buildNextElement();
    const previousElement = this.buildPreviousElement();

    this.navigation = document.createElement('div');
    this.navigation.classList.add('siema-nav');

    this.navigation.appendChild(nextElement);
    this.navigation.appendChild(previousElement);

    this.selector.appendChild(this.navigation);
  }

  /**
   * Builds the next element. It's possible include an html string inside the button, however, whether
   * the parameter navigation not containg a html string, the function returns a button with 'Next' text inside itself.
   *
   * @returns { HTMLDivElement } return the div element that represent the button next
   */
  buildNextElement(){
    const nextElement = document.createElement('div');
    let insideNext = 'Next';

    nextElement.classList.add('siema-nav-item', '-next');

    //Check whether navigation config is a object and whether next property not is null.
    if(typeof this.config.navigation === 'object'){
      if(!!this.config.navigation.next){
        insideNext = this.config.navigation.next;
      }
    }
    nextElement.innerHTML = insideNext;

    //Attach next function on click to nextElement
    nextElement.addEventListener('click', f => {
      this.next.call(this)
    });

    return nextElement;
  }

  /**
   * Builds the previous element. It's possible include an html string inside the button, however, whether
   * the parameter navigation not containg a html string, the function returns a button with 'Previous' text inside itself.
   * @returns { HTMLDivElement } return the div element that represent the button prev
   */
  buildPreviousElement(){
    const previousElement = document.createElement('div');
    let insidePrev = 'Previous';

    previousElement.classList.add('siema-nav-item', '-prev');

    //Check whether navigation config is a object and whether prev property not is null.
    if(typeof this.config.navigation === 'object'){
      if(!!this.config.navigation.prev){
        insidePrev = this.config.navigation.prev;
      }
    }
    previousElement.innerHTML = insidePrev;

    //Attach prev function on click to prevElement
    previousElement.addEventListener('click', f => {
      this.prev.call(this);
    });

    return previousElement;
  }
}
