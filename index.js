const {applyMiddleware, compose, createStore, combineReducers} = require('redux');
const remoteDevTools = require('remote-redux-devtools');
const thunk = require('redux-thunk');
const remotedev = require('remotedev-server');
const events = require('events');
const child_process = require('child_process');

const toUnderscore = (input) => input.split(/(?=[A-Z])/).join('_').toUpperCase();
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
class NodeReduxInterface extends events{
  constructor(options){
    super();
    this.server = null;
    this.subscribers = [];
    this.subscribersMap = {};
    this.reducers = [];
    this.store = {};
    this.state = {};
    this.options = {
      component:{
        stateRef:'__STATE__',
        emitterRef: '__UPDATE_STORE__',
        listenerRef:'__ON_STATE_CHANGE__',
        dispatchRef:'__DISPATCH__'
      }
    }
    if(options){
      this.setup();
    }
  }
  setup(options){

  }
  create(){
    console.log(this.reducers)
    if((Array.isArray(this.reducers) && !this.reducers.length) || !Object.keys(this.reducers).length){
      return console.log(new Warning('No reducers were set when creating store'))
    }

    let allReducers = combineReducers(this.reducers);
    this.store = createStore(allReducers, this.state, this.middleware);
    return this.store;
  }
  dispatch(multiFormatAction, payload){
    if(!this.store.dispatch){
      return console.log(new Warning('Store has not been instantiated yet.', 'Please call create() first before dispatching events'));
    }
    if(typeof multiFormatAction === 'string'){

    }
  }
  dispatchTo(componentName ,payload){
    const isSubscriber = this.subscribersMap.hasOwnProperty(componentName);
    if(isSubscriber){
      console.log(this.subscribersMap[componentName])
      let index = this.subscribersMap[componentName].subscriberIndex;
      this.subscribers[index].prototype[this.options.component.listenerRef](payload);

    }
    let internalStoreName = `${toUnderscore(componentName)}_COMPONENT`
    this.store.dispatch({type:internalStoreName, payload});
  }
  injectState(STATE={}){
    this.state = Object.assign(this.state, STATE);
  }
  addReducer(reducerFunction){
    let e = new Warning(`reducer is not a function`);
    if(typeof reducerFunction === 'function'){
      this.reducers.push(reducerFunction)
    }else if(Array.isArray(reducerFunction)){
      reducerFunction.forEach(fn => {
        if(typeof fn === 'function'){
          this.reducers.push(reducerFunction);
        }else{
          console.log(err);
        }
      });
    }else{
      console.log(err);
    }
  }
  bindReducerToState(reducerStateBindings={}){
    this.reducers = reducerStateBindings;
  }
  addMiddleWare(middlewareFunction){
    let e = new Warning(`middleware is not a function`);
    if(typeof middlewareFunction === 'function'){
      this.middleware.push(middlewareFunction)
    }else if(Array.isArray(middlewareFunction)){
      middlewareFunction.forEach(fn => {
        if(typeof fn === 'function'){
          this.middleware.push(middlewareFunction);
        }else{
          console.log(err);
        }
      });
    }else{
      console.log(err);
    }
  }
  startServer({port, hostname='localhost'}){
    this.server = remotedev({port, hostname});
    console.log(`
    Redux devtools listening. ${hostname}:${port}
    `);
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
      component.prototype[this.options.component.listenerRef](dispatchEvent);
    })
  }
  updateStoreVIAComponent(componentName, optionalPayload){
    let internalStoreName = `${toUnderscore(componentName)}_COMPONENT`;
    console.log(toUnderscore(componentName))
    this.store.dispatch({type:internalStoreName, payload:optionalPayload});
  }
  updateStoreVIAGlobal(componentName, dispatchEvent, emitLocally=false){
    if(!dispatchEvent || !dispatchEvent.type){
      return console.log(new Warning('Expected to dispatch event to have "type" property specified'));
    }
    let exclude = [componentName];
    if(emitLocally){
      let index = this.subscribersMap[componentName].subscriberIndex;
      this.subscribers[index].prototype[this.options.component.listenerRef](dispatchEvent);
      exclude = [];
    }
    this.dispatch(dispatchEvent, {exclude});
  }
  addComponent(classComponent){
    const isSubscriber = this.subscribersMap.hasOwnProperty(classComponent.name);
    if(isSubscriber){
      const w = new Warning(`${classComponent.name} already exists in store`);
      return console.log(w);
    }
    classComponent.prototype[this.options.component.stateRef] = {};
    classComponent.prototype[this.options.component.emitterRef] = this.updateStoreVIAComponent.bind(this, classComponent.name);
    classComponent.prototype[this.options.component.dispatchRef] = this.updateStoreVIAGlobal.bind(this, classComponent.name);
    this.subscribers.push(classComponent);

    this.subscribersMap[classComponent.name] = {
      name: classComponent.name,
      subscriberIndex: this.subscribers.length - 1
    };
    return classComponent;
  }
}

module.exports = new NodeReduxInterface();