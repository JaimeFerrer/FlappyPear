# Assets

Este juego dibuja al personaje ("La Pera") por código en `game.js`
(función `drawPear`) como placeholder, ya que todavía no tengo el
archivo de imagen real con la cara de Pablo recortada del cartel.

## Cómo poner la imagen real de Pablo

1. Exporta/recorta del cartel solo el personaje (la pera-avión con la
   cara), a ser posible en PNG con fondo transparente. Cuanto más
   ajustado el recorte, mejor encajará como sprite.
2. Guarda el archivo aquí como `assets/pera-pablo.png`.
3. En `game.js`, sustituye la función `drawPear()` por una que dibuje
   la imagen cargada, por ejemplo:

   ```js
   const pearImg = new Image();
   pearImg.src = "assets/pera-pablo.png";

   function drawPear() {
     ctx.save();
     ctx.translate(pear.x, pear.y);
     ctx.rotate(pear.rotation);
     const size = PEAR_R * 3.2; // ajustar según proporciones del PNG
     ctx.drawImage(pearImg, -size / 2, -size / 2, size, size);
     ctx.restore();
   }
   ```

4. Ajusta `size` hasta que el tamaño del avión-pera case bien con las
   tuberías y el suelo.
