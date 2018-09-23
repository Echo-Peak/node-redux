const fs = require('fs');
const path = require('path');

module.exports = {
  update(filepath='', json={}){
    let str = JSON.stringify(json);
    fs.writeFile(filepath, str, (err)=>{
      if(err){
        console.log(err);
      }
    });
  }
}