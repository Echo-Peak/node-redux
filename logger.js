var colors = require('colors/safe');

let enabled = true;
module.exports = {
  setup(willEnable){
    if(!willEnable){
      enabled = false;
    }
  },
  success(msg){
    if(!enabled) return;
    console.log(colors.green(msg));
  }
}