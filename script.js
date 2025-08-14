// Canvas setup
var canvas = new fabric.Canvas('canvas');
var originalImage, segmentedImage; // Original aur segmented (character only)
var pins = []; // Puppet pins (frames)
var keyframes = []; // Keyframes array
var currentFrame = 0;
var recorder, chunks = [];
var detector; // PoseNet model

// Load PoseNet model asynchronously
async function loadPoseNet() {
  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model);
}

// Image upload
document.getElementById('imageUpload').addEventListener('change', async function(e) {
  var file = e.target.files[0];
  var reader = new FileReader();
  reader.onload = function(f) {
    fabric.Image.fromURL(f.target.result, function(img) {
      canvas.add(img);
      img.scaleToWidth(400);
      img.set({left: 100, top: 100});
      originalImage = img;
      canvas.renderAll();
      loadPoseNet(); // Load model after upload
    });
  };
  reader.readAsDataURL(file);
});

// Segment Button: AI se character alag karo (background fixed rahega)
document.getElementById('segment').addEventListener('click', async function() {
  if (!originalImage) return alert('Pahle image upload karo!');
  const net = await bodyPix.load();
  const segmentation = await net.segmentPerson(originalImage.getElement());
  
  // Create masked image (character only, transparent BG)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = originalImage.width;
  maskCanvas.height = originalImage.height;
  const ctx = maskCanvas.getContext('2d');
  ctx.drawImage(originalImage.getElement(), 0, 0);
  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (segmentation.data[i / 4] === 0) { // Background pixel
      imageData.data[i + 3] = 0; // Transparent banao
    }
  }
  ctx.putImageData(imageData, 0, 0);
  
  // Add segmented to canvas, original as background
  canvas.remove(originalImage);
  const bg = new fabric.Image(originalImage.getElement(), {selectable: false}); // Fixed BG
  canvas.add(bg);
  bg.sendToBack();
  fabric.Image.fromURL(maskCanvas.toDataURL(), function(segImg) {
    canvas.add(segImg);
    segImg.set({left: 100, top: 100, selectable: true});
    segmentedImage = segImg;
    canvas.renderAll();
  });
  alert('Character alag ho gaya! Ab background change nahi hoga.');
});

// Add Pins Button: Auto frames (pins) body pe lagao using PoseNet
document.getElementById('addPins').addEventListener('click', async function() {
  if (!segmentedImage || !detector) return alert('Pahle segment karo aur model load hone do!');
  const poses = await detector.estimatePoses(segmentedImage.getElement());
  if (poses.length > 0) {
    const keypoints = poses[0].keypoints; // Body joints (nose, shoulders, elbows, etc)
    keypoints.forEach(kp => {
      if (kp.score > 0.5) { // Reliable points only
        const pin = new fabric.Circle({
          left: kp.x + segmentedImage.left - segmentedImage.width / 2, // Adjust position
          top: kp.y + segmentedImage.top - segmentedImage.height / 2,
          radius: 5,
          fill: 'red',
          selectable: true
        });
        canvas.add(pin);
        pins.push(pin);
      }
    });
    canvas.renderAll();
    alert('Auto pins (frames) lag gaye! Ab pins drag karke position set karo.');
  } else {
    alert('Body detect nahi hua. Manually pins add karo (code extend karo).');
  }
});

// Add Keyframe: Current pins positions save
document.getElementById('addKeyframe').addEventListener('click', function() {
  if (pins.length === 0) return alert('Pahle pins add karo!');
  const frame = pins.map(pin => ({left: pin.left, top: pin.top}));
  keyframes.push(frame);
  alert('Keyframe added! Pins drag karke next set karo.');
});

// Play Animation: Pins move karke image warp (simple move for now, warp advanced)
document.getElementById('play').addEventListener('click', function() {
  if (keyframes.length < 2) return alert('Kam se kam 2 keyframes!');
  currentFrame = 0;
  animateNext();
});

function animateNext() {
  if (currentFrame < keyframes.length - 1) {
    pins.forEach((pin, i) => {
      pin.animate({
        left: keyframes[currentFrame + 1][i].left,
        top: keyframes[currentFrame + 1][i].top
      }, {
        duration: 1000, // Smooth 1 sec
        easing: fabric.util.ease.easeInOutQuad, // Smooth motion
        onChange: function() {
          canvas.renderAll();
        },
        onComplete: () => {
          if (i === pins.length - 1) {
            currentFrame++;
            animateNext();
          }
        }
      });
    });
  }
}

// Record: Animation record aur download
document.getElementById('record').addEventListener('click', function() {
  var stream = canvas.lowerCanvasEl.captureStream(30);
  recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  chunks = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    var blob = new Blob(chunks, { type: 'video/webm' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'animation.webm';
    a.click();
  };
  recorder.start();
  alert('Recording! Play dabao.');
  setTimeout(() => recorder.stop(), 10000); // Time adjust karo animation ke hisaab se
});
