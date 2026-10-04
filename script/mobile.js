/* Responsive presentation only. World and Space retain their original game coordinates. */
var MobileUI = {
  touchDevice: /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches),
  enabled: false,
  ready: false,

  detect: function() {
    this.enabled = this.touchDevice || window.matchMedia('(max-width: 700px)').matches;
    document.documentElement.classList.toggle('mobile', this.enabled);
  },

  init: function() {
    if(this.ready) return;
    this.ready = true;
    var self = this;
    this.storesParent = $('#storesContainer').parent();
    $('<div id="mobileStores">').appendTo('#main');
    this.controls = $('<div id="mobileControls" role="group">')
      .attr('aria-label', _('Movement controls')).appendTo('#wrapper');
    var directions = [ ['up', '↑', 38, _('move up')], ['left', '←', 37, _('move left')],
      ['down', '↓', 40, _('move down')], ['right', '→', 39, _('move right')] ];
    directions.forEach(function(direction) {
      var button = $('<button type="button">').attr('data-direction', direction[0])
        .attr('aria-label', direction[3]).text(direction[1]).appendTo(self.controls)[0];
      button.addEventListener('pointerdown', function(event) {
        if(!self.canMove() || Engine.activeModule !== Space) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        Space.keyDown({which: direction[2]});
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(name) {
        button.addEventListener(name, function() { Space.keyUp({which: direction[2]}); });
      });
      // A completed tap moves exactly one tile; dragging to scroll does not move.
      button.addEventListener('click', function() {
        if(self.canMove() && Engine.activeModule === World) World.keyDown({which: direction[2]});
      });
    });
    var language = $('<select id="mobileLanguage" class="menuBtn">').attr('aria-label', _('Language'));
    $.each(window.langs || {}, function(code, label) {
      $('<option>').val(code).text(label).appendTo(language);
    });
    language.val(window.lang || 'en').on('change', function() {
      Engine.switchLanguage($('<span>').attr('data-language', this.value)[0]);
    }).prependTo('.menu');
    this.backdrop = $('<div id="eventBackdrop" aria-hidden="true">').appendTo('body');
    // Events are direct wrapper children. Watching only this level avoids observing
    // map redraws, cooldowns, or state updates and introduces no gameplay polling.
    this.observer = new MutationObserver(function() { self.syncDialog(); });
    this.observer.observe(document.getElementById('wrapper'), {childList: true});
    window.addEventListener('resize', function() { self.refresh(); });
    // Android keyboards can shrink only the visual viewport, leaving innerHeight unchanged.
    if(window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() { self.updateViewport(); });
      window.visualViewport.addEventListener('scroll', function() { self.updateViewport(); });
    }
    window.addEventListener('blur', function() { self.release(); });
    document.addEventListener('visibilitychange', function() { if(document.hidden) self.release(); });
    document.addEventListener('click', function(event) {
      if(self.enabled && $(event.target).closest('#map').length && !self.canMove()) {
        event.stopImmediatePropagation();
      }
    }, true);
    this.refresh();
  },

  canMove: function() {
    return this.enabled && !Engine.keyLock && !Events.activeEvent() && !document.hidden &&
      (Engine.activeModule !== Space || !Space.done);
  },

  release: function() {
    if(typeof Space !== 'undefined') Space.up = Space.down = Space.left = Space.right = false;
  },

  updateViewport: function() {
    var viewport = window.visualViewport;
    document.documentElement.style.setProperty('--mobile-viewport-height',
      (viewport ? viewport.height : window.innerHeight) + 'px');
    document.documentElement.style.setProperty('--mobile-viewport-top',
      (viewport ? viewport.offsetTop : 0) + 'px');
  },

  syncDialog: function() {
    var panel = document.querySelector('.eventPanel');
    var open = !!panel;
    if(open && !this.dialogOpen) this.focusBeforeDialog = document.activeElement;
    document.documentElement.classList.toggle('event-open', open);
    // The map is a display surface with thousands of non-focusable cells. Making
    // its ancestor inert invalidates every cell's style on each combat entry.
    // Keep actual controls inert; the backdrop and World.click guard block the map.
    $('#main, #spacePanel, #mobileControls, .menu, .logo').each(function() {
      if(this.inert !== open) this.inert = open;
    });
    if(open) {
      if(!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
      $('#content').attr('aria-hidden', 'true');
    } else {
      $('#content').removeAttr('aria-hidden');
      if(this.dialogOpen && this.focusBeforeDialog && this.focusBeforeDialog.isConnected) {
        this.focusBeforeDialog.focus({ preventScroll: true });
      }
      this.focusBeforeDialog = null;
    }
    this.dialogOpen = open;
    if(open) this.release();
    if(!document.getElementById('content')) this.controls.hide();
  },

  refresh: function() {
    var wasEnabled = this.enabled;
    this.detect();
    this.updateViewport();
    if(!this.ready) return;
    var module = Engine.activeModule;
    var world = module === World, space = module === Space;
    if(this.enabled && world && $('#mapLegend').length) {
      if(this.controls[0].nextSibling !== $('#mapLegend')[0]) this.controls.insertBefore('#mapLegend');
    } else if(this.controls.parent()[0] !== $('#wrapper')[0]) {
      this.controls.appendTo('#wrapper');
    }
    document.documentElement.classList.toggle('mobile-world', this.enabled && world);
    document.documentElement.classList.toggle('mobile-space', this.enabled && space);
    $('.location').removeClass('mobile-active');
    if(module && module.panel) module.panel.addClass('mobile-active');
    var parent = this.enabled ? $('#mobileStores') : this.storesParent;
    if($('#storesContainer').parent()[0] !== parent[0]) $('#storesContainer').appendTo(parent);
    if(this.enabled) {
      $('#notifications').insertBefore('#content');
      var wrapper = document.getElementById('wrapper');
      if(!wrapper) return; // The ending removes the game UI.
      var style = window.getComputedStyle(wrapper);
      var width = wrapper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      document.documentElement.style.setProperty('--mobile-map-width', (width - 2) + 'px');
      // Flight is scaled as a single 700px stage; collision geometry stays unchanged.
      var scale = Math.min($('#content').width(), window.innerHeight * 0.58) / 700;
      document.documentElement.style.setProperty('--mobile-space-scale', scale);
      document.documentElement.style.setProperty('--mobile-space-size', 700 * scale + 'px');
    } else if(wasEnabled) {
      $('#notifications').appendTo('#wrapper');
    }
    this.release();
    this.syncDialog();
    Engine.queueLayout();
  }
};
MobileUI.detect();
