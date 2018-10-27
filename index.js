const {applyMiddleware, compose, createStore, combineReducers} = require('redux');
const remoteDevTools = require('remote-redux-devtools');
const events = require('events');
const _ = require('lodash');
const path = require('path');
const utilities = require('./util-helper');
const logger = require('./logger');
const uuid = require('uuid');
const syncStateToFileSystem = require('./sync-state-to-filesystem');

const toUnderscore = (input) => input.split(/(?=[A-Z])/).join('_').toUpperCase();
const GlobalErrors = [
  EvalError,
  Error,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError
];
class Warning extends Error{
  constructor(title, message){
    super();
    if(message){
      this.title = title;
      this.body = message;
    }else{
      this.message = title;
    }
    this.name = 'Warning'
  }
}

class NodeReduxComponentsInterface extends events{
  constructor(){
    super();
    this.server = null;
    this.subscribers = [];
    this.subscribersMap = {};
    this.reducers = {};
    this.store = {};
    this.state = {};
    this.statelessComponents = {};
    this.ready = false;
    this.middleware = [];
    this.bindedReducers = [];
    this.options = {
      suppressErrors: false,
      suppressWarnings: false,
      syncStateToFileSystem: false,
      syncStateToFileSystemPath:null,
      enableLogger: true,
      dispatchBeforeLocalReducer: true,
      enablePromiseRejectionEvent: true,
      component:{
        stateRef:'__STATE__',
        builtInRef:'__BUILTIN__',
        emitterRef: '__UPDATE_STORE__',
        listenerRef:'__ON_STATE_CHANGE__',
        dispatchRef:'__DISPATCH__'
      }
    }
    this.builtinUtilities = new utilities(this);
  }
  addGlobalErrors(errors){
    if(Array.isArray(errors)){
      GlobalErrors = GlobalErrors.concat(errors);
    }else{
      GlobalErrors.push(errors);
    }
  }
  async(promiseType=Promise){
    let self = this;
    let trace = new Error();
    return {
      as(eventName, callback){
        if(typeof callback === 'function' && typeof promiseType === 'function'){
          promiseType(callback);
          return;
        }else if((promiseType instanceof Promise) && typeof callback === 'function'){
          promiseType.then((result) => {
            let o = {
              action: `${eventName.toUpperCase()}_PROMISE_RESOLVED`,
              payload: result
            }
            self.dispatch(o);
            callback(null, result);
          }).catch(error => {
            self.handlePromiseRejection(error, trace.stack);
            let o = {
              action: `${eventName.toUpperCase()}_PROMISE_ERROR`,
              error
            }
            
            self.dispatch(o);
            callback(error);
          });
          return;
        }
        if((promiseType instanceof Promise) && typeof eventName === 'string' && eventName.length){
          return new Promise((resolve, reject) => {
            promiseType.then((result) => {
              let o = {
                action: `${eventName.toUpperCase()}_PROMISE_RESOLVED`,
                payload: result
              }
              self.dispatch(o);
              resolve(result);
            }).catch(error => {
              self.handlePromiseRejection(error, trace.stack);
              let o = {
                action: `${eventName.toUpperCase()}_PROMISE_ERROR`,
                error
              }
              self.dispatch(o);
              reject(error);
            });
            
          });
        }else{
          return new Promise((_, reject)=>{
            let o = {
              type: `${eventName.toUpperCase()}_PROMISE_ERROR`,
              error: new Error(`"${eventName}" is not a promise`)
            }
            if(!eventName){
              o.error = new Error(`"eventName" is not a string`);
            }
            self.logErr(o.error);
            reject(reject);
          })
        }
      }
    }
  }
  /**
   * Getters
   */
  get componentList(){
    return Object.keys(this.subscribersMap);
  }
  logErr(){
    if(!this.options.suppressErrors){
      console.log(...arguments);
    }
  }
  logWarn(title='', msg=''){
    if(!this.options.suppressWarnings){
      return console.log(new Warning(title, msg));
    }
    return false;
  }
  setup(options={}){
    if(options && typeof options === 'object' && !Array.isArray(options)){
      if(_.get(options, 'component')){
        this.options.component = options.component;
      }else{
        for(let prop in options){
          if(this.options.hasOwnProperty(prop)){
            this.options[prop] = options[prop];
          }
        }
      }
    }else{
      return this.logWarn('Expected "options" to be an object during setup');
    }
    if(options.syncStateToFileSystem){
      if(!options.syncStateToFileSystemPath){
        this.logWarn(new Warning(`Expected "syncStateToFileSystemPath" to be specified`));
      }else{
        this.options.syncStateToFileSystem = true;
        let isJsonFile = path.basename(options.syncStateToFileSystemPath).split('.')[1];
        if(isJsonFile !== 'json'){
          this.logWarn('Expected "syncStateToFileSystemPath" to be a json file');
        }
        this.options.syncStateToFileSystemPath = options.syncStateToFileSystemPath;
      }
    }
    logger.setup(this.options.enableLogger);
    logger.success("Node Redux setup successfully");
  }
  create(){
    this.ready = true;
    if((Array.isArray(this.reducers) && !this.reducers.length) || !Object.keys(this.reducers).length){
      return this.logWarn('No reducers were set when creating store');
    }
    let allReducers = combineReducers(this.reducers);
    let allMiddleware = applyMiddleware(...this.middleware);
    this.store = createStore(allReducers, this.state, allMiddleware);
    if(this.options.syncStateToFileSystem && this.options.syncStateToFileSystemPath){
      this.store.subscribe(()=>{
        syncStateToFileSystem.update(this.options.syncStateToFileSystemPath, this.store.getState());
      })
    }
    this.storeReady = true;
    return this.store;
  }
  dispatchTo(componentNameOrArray ,payload){
    const notifyComponent = (comp)=>{
      const isSubscriber = this.subscribersMap.hasOwnProperty(comp);
      if(isSubscriber){
        let index = this.subscribersMap[comp].subscriberIndex;
        this.subscribers[index].prototype[this.options.component.listenerRef](payload);
      }
      let internalStoreName = `${toUnderscore(comp)}_COMPONENT`;
      this.store.dispatch({type:internalStoreName, payload});
    }
    if(Array.isArray(componentNameOrArray)){
      componentNameOrArray.forEach(comp => notifyComponent(comp));
    }else{
      notifyComponent(componentNameOrArray);
    }
  }
  injectState(STATE={}){
    this.state = Object.assign(this.state, STATE);
  }
  addReducer(reducerFunction){
    let err = new Warning(`reducer is not a function`);
    if(typeof reducerFunction === 'function'){
      this.reducers.push(reducerFunction)
    }else if(Array.isArray(reducerFunction)){
      reducerFunction.forEach(fn => {
        if(typeof fn === 'function'){
          this.reducers.push(reducerFunction);
        }else{
          this.logWarn(err);
        }
      });
    }else{
      this.logWarn(err);
    }
  }
  bindReducerToState(reducerStateBindings={}){
    for(let rootProp in reducerStateBindings){
      if(typeof reducerStateBindings[rootProp] !== 'function'){
        this.logWarn('Could not bind reducer function to nested property');
      }else{
        this.reducers[rootProp] = reducerStateBindings[rootProp];
      }
    }
  }
  addMiddleWare(middlewareFunction){
    let err = new Warning(`middleware is not a function`);
    if(typeof middlewareFunction === 'function'){
      this.middleware.push(middlewareFunction)
    }else if(Array.isArray(middlewareFunction)){
      middlewareFunction.forEach(fn => {
        if(typeof fn === 'function'){
          this.middleware.push(middlewareFunction);
        }else{
          this.logWarn(err);
        }
      });
    }else{
      this.logWarn(err);
    }
  }
  injectRemoteDevTools({port, hostname='localhost', realtime=true}){
      let client = remoteDevTools.default({ realtime: realtime, port:port, hostname: hostname });
      this.middleware.push(client);
      console.log(`
      Prerequisite: Socket server.
      A server like "RemoteDev Server"(https://github.com/zalmoxisus/remotedev-server) is required to work in conjunction of the 
      client "remote DevTools" to work with the Redux devtools extension.

      Redux devtools server listening. ${hostname}:${port}
  
      How to connect(assuming you have the Redux DevTools extension enabled):
      1. In the browser, right click on Redux DevTools extension icon
      2. Select "Open Remote DevTools"
      3. Click Settings at the bottom
      4. Check "User custom (local) server"
      5. set Host name to "${hostname}"
      6. set Port to "${port}"
      7. Click submit
      `);
      this.ready = true;
      this.emit('ready');

  }
  dispatch(dispatchEvent, options){
    let restricted = [];
    let prepareEvents = this.subscribers.filter(component => {
      let name = component.name;
      
      if(options && typeof options === 'object' && !Array.isArray(options)){
        let exitsInIncludeArray =  options.include ? options.include.includes(name) : false;
        let exitsInExcludeArray =  options.exclude ? options.exclude.includes(name) : false;
        if(exitsInExcludeArray){
          restricted.push(name);
          return false;
        }else if(!restricted.includes(name)){
          return true;
        }

        if(options && exitsInIncludeArray){
          return true;
        }
      }else{
        return true;
      }
    });
    prepareEvents.forEach(component => {
      if(typeof component.prototype[this.options.component.listenerRef] === 'function'){
        component.prototype[this.options.component.listenerRef](dispatchEvent);
      }
    });
    if(this.options.dispatchBeforeLocalReducer){
      this.store.dispatch({
        type: dispatchEvent.action,
        payload: dispatchEvent.payload
      });
    }
    this.bindedReducers.forEach(boundReducer => {
      let name = `${boundReducer.name.toUpperCase()}_COMPONENT`;
      if(dispatchEvent.action.indexOf(name) >= 0){
        let newEvent = boundReducer.reducer(this.store.getState(), dispatchEvent);
        if(newEvent && (newEvent.hasOwnProperty('action') || newEvent.hasOwnProperty('type'))){
          dispatchEvent = newEvent;
        }
      }
    });
    for(const statelessComponent in this.statelessComponents){
      let comp = this.statelessComponents[statelessComponent];
      if(comp.event === dispatchEvent.action && typeof comp.fn === 'function'){
        comp.fn(dispatchEvent);
      }
    }
  }
  updateStoreVIAComponent(componentName, optionalPayload){
    let internalStoreName = `${toUnderscore(componentName)}_COMPONENT`;
    this.store.dispatch({type:internalStoreName, payload:optionalPayload});
  }
  updateStoreVIAGlobal(componentName, dispatchEvent, emitLocally=false){
    if(!dispatchEvent || !dispatchEvent.type){
      return this.logWarn('Expected to dispatch event to have "type" property specified');
    }
    let exclude = [componentName];
    if(emitLocally){
      let index = this.subscribersMap[componentName].subscriberIndex;
      if(typeof this.subscribers[index].prototype[this.options.component.listenerRef]){
        this.subscribers[index].prototype[this.options.component.listenerRef](dispatchEvent);
      }
      exclude = [];
    }
    this.dispatch(dispatchEvent, {exclude});
  }
  addComponent(classComponent, options={}){
    if(classComponent.hasOwnProperty('name') && !classComponent.name){
      return this.logWarn('Can not add component to store. A component needs to be named class/function');
    }
    let name = classComponent.name;
    if(options.reducer){
      if(options.bindContext){
        this.bindedReducers.push({
          name: name,
          reducer: options.reducer.bind(classComponent.prototype)
        });
      }else{
        this.bindedReducers.push({
          name: name,
          reducer: options.reducer
        });
      }
    }
    const isSubscriber = this.subscribersMap.hasOwnProperty(classComponent.name);
    if(isSubscriber){
      return this.logWarn(`${classComponent.name} already exists in store`);
    }
    if(!options.ignoreBuiltin){
      classComponent.prototype[this.options.component.builtInRef] = this.builtinUtilities;
    }
    if(!options.ignoreDispatchEvents){
      classComponent.prototype[this.options.component.emitterRef] = this.updateStoreVIAComponent.bind(this, classComponent.name);
    }
    if(!options.ignoreEvents){
      classComponent.prototype[this.options.component.dispatchRef] = this.updateStoreVIAGlobal.bind(this, classComponent.name);
      this.subscribers.push(classComponent);
      this.subscribersMap[classComponent.name] = {
        name: classComponent.name,
        subscriberIndex: this.subscribers.length - 1
      };
    }
    classComponent.prototype[this.options.component.stateRef] = {};

    return classComponent;
  }
  addBuiltin(builtinName, builtinInterface){
    this.builtinUtilities[builtinName] = builtinInterface;
  }
  getState(){
    if(!this.storeReady){
      return this.STATE;
    }
    return this.store.getState();
  }
  handlePromiseRejection(err, trace){
    const isGlobalError = GlobalErrors.findIndex(e => (err instanceof e));
    if(isGlobalError >= 0){
      err.stack = trace;
      this.emit('PromiseRejection', err);
    }
  }
  stateless(listener, options={}){
    if(typeof listener !== 'function') return this.logWarn(`Unable to create stateless component from a '${typeof listener}'. Must be a function`);
    const eventName = options.onEvent;
    let id = uuid.v4();
    this.statelessComponents[id] = {
      event: eventName,
      fn: listener
    }
    return id;
  }
  unbindStateless(id){
    for(let compID in this.statelessComponents){
      if(compID === id){
        delete this.statelessComponents[compID];
        return true;
      }
    }
    return false;
  }

}

module.exports = new NodeReduxComponentsInterface();