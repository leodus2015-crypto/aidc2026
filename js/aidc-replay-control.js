(function (global) {
  "use strict";

  function setState(button, state) {
    if (!button) return;
    button.dataset.state = state;
    button.setAttribute("aria-pressed", state === "paused" ? "true" : "false");
  }

  function pause(root) {
    if (!root) return;
    root.classList.add("aidc-animation-paused");
  }

  function resume(root) {
    if (!root) return;
    root.classList.remove("aidc-animation-paused");
  }

  function reset(root) {
    resume(root);
  }

  global.AidcReplayControl = {
    setState: setState,
    pause: pause,
    resume: resume,
    reset: reset
  };
})(window);
