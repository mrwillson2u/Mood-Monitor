var renderer = PIXI.autoDetectRenderer(800, 600, {antialias: true});
document.body.appendChild(renderer.view);

var socket = io();

var stage = new PIXI.Container(0x000000);
var graphics = new PIXI.Graphics()

var points = [];

graphics.beginFill(0xFF0000);

graphics.drawCircle(100, 100, 5);

graphics.lineStyle(2, 0xFF0000);
graphics.moveTo(200, 300);
graphics.lineTo(72, 93);

graphics.moveTo(10, 400);
graphics.lineTo(43, 283);

stage.addChild(graphics);

animate();

function animate() {

    renderer.render(stage);
    requestAnimationFrame( animate );
}

socket.on('mood data', function(msg){
  // $('#messages').append($('<li>').text(msg));
  points.push(msg);
  console.log('recieved: ' + msg);
});
