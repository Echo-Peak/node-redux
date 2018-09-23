const fs = require('fs');
const toUnderscore = (input) => input.split(/(?=[A-Z])/).join('_').toUpperCase();

module.exports = class UtilHelper{
  constructor(parentContext){
    this.parentContext = parentContext;
    this.fs = {};
    this.child_process = {}

    for(let prop in fs){
      if(typeof fs[prop] === 'function'){
        this.fs[prop] = this._fs.bind(this, prop);
      }
    }
  }
  _fs(method, ...args){
    return new Promise((resolve, reject)=>{
      let out = {
        type: `${toUnderscore(method)}`,
        action: 'FILESYSTEM',
        payload: {
          file: args[0],
          error: null,
          output: null
        }
      }
      if(method.toLowerCase().indexOf('sync') >= 0){
        try{
          let result = fs[method](...args);
          out.payload.output = result;
          if(this.parentContext.options.ignoreFilesystemOutput){
            out.payload.output = null;
          }
          this.parentContext.dispatch(out);
          resolve(result);
        }catch(err){
          out.payload.error = err;
          if(this.parentContext.options.ignoreFilesystemOutput){
            out.payload.error = null;
          }
          reject(result);
        }
        return
      }
      fs[method](...args, (errorFirst, output)=>{
        out.payload.error = errorFirst;
        out.payload.output = output;
        if(this.parentContext.options.ignoreFilesystemOutput){
          out.payload.output = null;
          out.payload.error = null;
        }
        console.log('dispatched');
        this.parentContext.dispatch(out);
        if((errorFirst instanceof Error)){
          reject(errorFirst);
        }else{
          resolve(output);
        }
      })
    });
  }
}