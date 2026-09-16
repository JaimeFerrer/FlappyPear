# Assets

`pera-pablo.png` is the real player sprite: Pablo's face on the
pear-plane, cropped from the birthday party flyer with a transparent
background. It's loaded and drawn by `drawPear()` in `game.js`.

If the image ever fails to load (e.g. served from a path that doesn't
exist), the game falls back to a simple code-drawn pear placeholder
(`drawPearPlaceholder()`) so the game never breaks.
