/**
 * Minimal jsdom polyfills for native browser features used by the UI
 * (`<dialog>` modal methods and the Popover API). Behavior only, no layout.
 */

if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  // Escape on an open modal dialog fires a cancelable "cancel" event.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
    const top = dialogs[dialogs.length - 1]
    if (!top) return
    const cancel = new Event('cancel', { cancelable: true })
    if (top.dispatchEvent(cancel)) top.close()
  })
}

if (typeof HTMLElement.prototype.showPopover !== 'function') {
  const OPEN = 'data-test-popover-open'
  const setOpen = (element: HTMLElement, open: boolean) => {
    if (element.hasAttribute(OPEN) === open) return
    element.toggleAttribute(OPEN, open)
    // jsdom hides every [popover] (it does not know :popover-open).
    element.style.display = open ? 'block' : ''
    const event = new Event('toggle')
    Object.assign(event, { newState: open ? 'open' : 'closed', oldState: open ? 'closed' : 'open' })
    element.dispatchEvent(event)
  }
  HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement) {
    // popover="auto": opening one closes the others.
    for (const other of document.querySelectorAll<HTMLElement>(`[${OPEN}]`)) {
      if (other !== this) setOpen(other, false)
    }
    setOpen(this, true)
  }
  HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement) {
    setOpen(this, false)
  }
  HTMLElement.prototype.togglePopover = function togglePopover(this: HTMLElement, force?: unknown) {
    const open = typeof force === 'boolean' ? force : !this.hasAttribute(OPEN)
    if (open) this.showPopover()
    else this.hidePopover()
    return open
  }
  // popovertarget buttons, light dismiss on outside click, Escape.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null
    const invoker = target?.closest('[popovertarget]')
    const id = invoker?.getAttribute('popovertarget')
    if (id) {
      document.getElementById(id)?.togglePopover()
      return
    }
    for (const open of document.querySelectorAll<HTMLElement>(`[${OPEN}]`)) {
      if (!target || !open.contains(target)) open.hidePopover()
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    for (const open of document.querySelectorAll<HTMLElement>(`[${OPEN}]`)) open.hidePopover()
  })
}

// Pointer capture and ResizeObserver (used by the plan canvas).
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
}
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

// Scrolling (summary banner of the "DO & assurances" tab).
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => undefined
}
