// Keyboard, mouse-drag camera and touch joystick input.
import nipplejs from 'nipplejs';

const MOVE_KEYS = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
};

export class Input {
  constructor(canvas, touchRoot) {
    this.canvas = canvas;
    this.enabled = false;
    this.keys = new Set();
    this.move = { x: 0, y: 0 }; // joystick, x right, y forward
    this.run = false;
    this.touchRun = false;
    this.look = { dx: 0, dy: 0 };
    this.handlers = {}; // action name -> callback
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => this.keys.clear());

    // Drag to look (mouse or a finger on the right side of the screen).
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      this.look.dx += e.clientX - drag.x;
      this.look.dy += e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    this.touchRoot = touchRoot;
    if (touchRoot) this.setupTouch(touchRoot);
  }

  setupTouch(root) {
    const zone = root.querySelector('[data-joystick]');
    if (!zone) return;
    this.joystick = nipplejs.create({ zone, mode: 'static', position: { left: '50%', top: '50%' }, color: '#ffffff', size: 110, restOpacity: 0.6 });
    this.joystick.on('move', (evt) => {
      const data = evt?.data ?? evt;
      const v = data?.vector, force = data?.force ?? 0;
      if (!v) return;
      this.move.x = v.x; this.move.y = v.y;
      this.touchRun = force > 0.85; // push the stick near its edge to run
    });
    this.joystick.on('end', () => { this.move.x = 0; this.move.y = 0; this.touchRun = false; });
    root.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.fire(b.dataset.action); });
      b.addEventListener('click', (e) => { if (e.detail === 0) this.fire(b.dataset.action); }); // keyboard activation
    });
  }

  on(action, fn) { this.handlers[action] = fn; }
  fire(action, arg) { if (this.enabled || action === 'menu') this.handlers[action]?.(arg); }

  onKey(e, down) {
    const t = e.target;
    const tag = t?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
    const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
    if (down && e.code === 'Escape') { this.fire('menu'); return; }
    if (!this.enabled) { if (!down) this.keys.delete(e.code); return; }
    if (MOVE_KEYS[e.code]) {
      if (down) this.keys.add(e.code); else this.keys.delete(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { this.run = down; return; }
    if (!down || e.repeat) return;
    if (onControl && (e.code === 'Space' || e.code === 'Enter')) return;
    switch (e.code) {
      case 'Space': e.preventDefault(); this.fire('jump'); break;
      case 'KeyE': this.fire('act'); break;
      case 'KeyQ': this.fire('scan'); break;
      case 'KeyR': this.fire('where'); break;
      case 'KeyH': this.fire('overlay'); break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
        this.fire('pick', +e.code.slice(5)); break;
      case 'KeyF': this.fire('finish'); break;
      default: break;
    }
  }

  // Movement intent in input space: x right, y forward, both -1..1.
  axes() {
    let x = this.move.x, y = this.move.y;
    for (const k of this.keys) {
      const d = MOVE_KEYS[k];
      if (d === 'f') y += 1; else if (d === 'b') y -= 1; else if (d === 'l') x -= 1; else if (d === 'r') x += 1;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, running: this.run || this.touchRun };
  }

  consumeLook() {
    const l = { ...this.look };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) { this.keys.clear(); this.move.x = this.move.y = 0; this.run = false; }
  }
}
