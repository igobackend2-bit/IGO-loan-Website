(function() {
  const canvas = document.getElementById('coinCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height;
  const coins = [];
  const coinCount = 50; 
  
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  
  window.addEventListener('resize', resize);
  resize();

  class Coin {
    constructor() {
      this.reset();
      this.y = Math.random() * height;
    }
    reset() {
      this.x = Math.random() * width;
      this.y = -50; 
      this.size = Math.random() * 10 + 6;
      this.speed = Math.random() * 1.5 + 1;
      this.drift = (Math.random() - 0.5) * 0.3;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.05;
      this.opacity = Math.random() * 0.4 + 0.1;
    }
    update() {
      this.y += this.speed;
      this.x += this.drift;
      this.rotation += this.rotationSpeed;
      if (this.y > height + 20) this.reset();
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(Math.cos(this.rotation * 0.5), 1); // Add 3D flip effect
      ctx.globalAlpha = this.opacity;
      
      // Coin Body
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
      gradient.addColorStop(0, '#fef3c7');
      gradient.addColorStop(0.4, '#fbbf24');
      gradient.addColorStop(1, '#92400e');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Rim
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.stroke();

      // Shine line
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.7, -this.size * 0.7);
      ctx.lineTo(this.size * 0.7, this.size * 0.7);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    }
  }

  for (let i = 0; i < coinCount; i++) coins.push(new Coin());

  function animate() {
    ctx.clearRect(0, 0, width, height);
    coins.forEach(coin => {
      coin.update();
      coin.draw();
    });
    requestAnimationFrame(animate);
  }
  animate();
})();
