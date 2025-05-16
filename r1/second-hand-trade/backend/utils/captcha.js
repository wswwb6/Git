const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');

// 生成验证码
function generateCaptcha() {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#f0f0f0'
  });
  
  // 生成验证码ID
  const captchaId = crypto.randomBytes(16).toString('hex');
  
  return {
    id: captchaId,
    text: captcha.text,
    data: captcha.data
  };
}

// 验证验证码
function verifyCaptcha(captchaId, inputText, storedText) {
  return inputText.toLowerCase() === storedText.toLowerCase();
}

module.exports = {
  generateCaptcha,
  verifyCaptcha
};
