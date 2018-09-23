const fs = require('fs');

module.exports = {
  name: 'filesystem',
  initialState:{
    files: {}
  },
  reducer({file='', outFile='', method='', data='', options={}, operation='read'}={}){
    return function(dispatch){
      return new Promise((resolve, reject)=>{
        if(!method) return reject(new Error('Expected method to be passed'));
        let actionType = `FILESYSTEM_${operation.toUpperCase()}`;
        const callback = (err, data)=>{
          let payload = {
            type:actionType, 
            payload:{
              file: file,
              operation,
              method
            }
          }
          if(err && (err instanceof Error)){
            payload.payload.error = err.stack;
            return reject(err);
          }else if(err){
            payload.payload.data = err;
            return resolve(err);
          }
          data = data.toString();
          payload.payload.data = data;
          dispatch(payload);
          resolve(data);
        }
        switch(operation){
          case 'read':{
            fs[method](file, options, callback);
          } break;
          case 'write':
          case 'copy': {
            fs[method](file, outFile, options, callback);
          } break; 
        }
      });
    }
  }
};