import fs from 'node:fs';
import vm from 'node:vm';

export function game() {
  let now = 0, nextTimer = 1;
  const timers = new Map(), elements = new Map();
  class Element {
    constructor() { this.values = {}; this.attrs = {}; this.length = 1; }
    data(key, value) { if (arguments.length === 1) return this.values[key]; this.values[key] = value; return this; }
    attr(key, value) { if (arguments.length === 1) return this.attrs[key]; this.attrs[key] = value; return this; }
    text(value) { if (arguments.length === 0) return this.value || ''; this.value = value; return this; }
    html(value) { return this.text(value); }
    hasClass() { return false; }
    width() { return 610; }
    height() { return 610; }
    offset() { return { left: 0, top: 0 }; }
    children() { return new Element(); }
    each() { return this; }
  }
  for (const method of ['appendTo','prependTo','append','prepend','addClass','removeClass','remove','empty','css','animate','stop','click','focus','insertAfter','insertBefore','find','closest','first','parent','show','hide']) {
    Element.prototype[method] = function() { return this; };
  }
  function $(selector) {
    if (selector instanceof Element) return selector;
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  }
  $.extend = (...args) => {
    if (args[0] === true) return Object.assign(args[1], structuredClone(args[2]));
    return Object.assign(...args.filter(Boolean));
  };
  $.Dispatch = () => ({ publish() {}, subscribe() {} });
  $.isEmptyObject = obj => !obj || !Object.keys(obj).length;
  $.inArray = (value, array) => array.indexOf(value);
  const schedule = (callback, delay, interval = false) => {
    const id = nextTimer++;
    timers.set(id, { callback, time: now + delay, delay, interval });
    return id;
  };
  const context = vm.createContext({
    console, $, jQuery: $, State: {}, document: {},
    _: (text, ...values) => text?.replace(/\{(\d+)\}/g, (_, i) => values[i]),
    setTimeout: (fn, delay) => schedule(fn, delay),
    setInterval: (fn, delay) => schedule(fn, delay, true),
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id),
    URL, Promise, Math: Object.create(Math)
  });
  context.window = context;
  const files = ['audioLibrary', 'audio', 'engine', 'state_manager', 'room', 'outside', 'world', 'path', 'ship', 'space', 'fabricator', 'prestige', 'scoring', 'events', 'events/encounters', 'events/setpieces', 'events/executioner', 'events/industry', 'events/ships', 'events/frontier'];
  for (const file of files) vm.runInContext(fs.readFileSync(`script/${file}.js`, 'utf8'), context, { filename: file });
  context.Fabricator = vm.runInContext('Fabricator', context);
  context.$SM = context.StateManager;
  Object.assign(context.Engine, {
    saveGame() {}, event() {}, log() {}, updateSlider() {}, updateOuterSlider() {},
    setTimeout: context.setTimeout, setInterval: context.setInterval
  });
  $.Dispatch = () => ({ publish() {}, subscribe() {} });
  context.Header = { addLocation: () => new Element() };
  context.Notifications = { notify() {} };
  context.Button = { Button: function(options) { const el = new Element(); el.attrs.id = options.id; return el; },
    setDisabled: (el, disabled = true) => { if (el) el.disabled = disabled; }, clearCooldown() {}, cooldown() {} };
  context.AudioEngine.playSound = context.AudioEngine.playBackgroundMusic = context.AudioEngine.playEventMusic = context.AudioEngine.stopEventMusic = () => {};
  context.Room.compassTooltip = () => {};
  context.$SM.init();
  context.Path.outfit = {};
  context.Events.eventStack = [];
  context.advance = duration => {
    const until = now + duration;
    let iterations = 0;
    while (true) {
      const pending = [...timers].filter(([, t]) => t.time <= until).sort((a, b) => a[1].time - b[1].time)[0];
      if (!pending) break;
      if (++iterations > 10000) throw Error('timer loop');
      const [id, timer] = pending;
      now = timer.time;
      if (timer.interval) timer.time += timer.delay; else timers.delete(id);
      timer.callback();
    }
    now = until;
  };
  context.timers = timers;
  context.element = $;
  context.json = value => JSON.parse(JSON.stringify(value));
  return context;
}
