# Node Redux Components
*node-redux-components* is a event emitter(pub/sub) system based around using redux for state management in a Object oriented architecure. This allows the application to benefit from the pub/sub paradigm as well as having a central store to store the application state of **subscribed** components.

## Install
```
# npm
npm run install node-redux-components

# yarn
yarn add node-redux-components
```

## Optional Install
Along side **node-redux-components**, the module **remotedev-server** can be installed to allow functionality of using the remote redux devTools console from the app

```
# npm
npm run install --save-dev remotedev-server

# yarn
yarn add --dev remotedev-server
```

## Usage

**Setup**

Setup is similar to a regular Redux application but in node-redux-components this works slightly different.
`NodeReduxComponents.setup()` takes in a object which has the following properties:
- suppressErrors - suppresses logging of errors. Default `false`
- suppressWarnings - suppresses logging of warning. Default `false`
- syncStateToFileSystem - Toggles synching the app state to a file in JSON format. Default `true`
- syncStateToFileSystemPath - Path of file to sync the app state to. Default `null`
- enableLogger - Toggles all logging. Default `true`
- dispatchBeforeLocalReducer - Toggles wether the pub/sub functionality to be called before the redux store is updated. Default `true`
- enablePromiseRejectionEvent - Toggles whether promise errors should be silent or emitted. Default `true`
- component - Sets the references to be used in each component when being decorated by `NodeReduxComponents.addComponent()`. See **Adjusting Component static references**
- 

```
const NodeReduxComponents = require('node-redux-components');

NodeReduxComponents.setup();

NodeReduxComponents.bindReducerToState({
  someReducer: yourReducerHere,
});

let store = NodeReduxComponents.create();
```
**Components**

Components can be thought of as "modules" in that once registered with node-redux-components, the **component** will be decorated with extended functionality.
Once decorated with `addComponent`, the class/function can be treated normally(you dont need to change/adjust the arguments arguments)

**Note:** Components MUST be named functions/classes

```
// module2.js
const NodeReduxComponents = require('node-redux-components');
class Manager{
  constructor(){

  }
}
module.exports = NodeReduxComponents.addComponent(Manager);

// in another file....
const Manager = require('./module2);

let manager = new Manager();

```

**Async**

Node-redux-components supported async operations via promises and callbacks. *Async* must take in `Promises`, Node-redux-components  will then take the output/error of the promise and dispatch it the *components* added/subscribed and then the reducers before the store is updated. The output/error will then be returned to the calling promise/callback.

**Note:** the callback uses the "error first" pattern

```
// Promises

let prom = new Promise((resolve)=>{
  setTimeout(() => resolve({test:29}), 1000);
});

NodeReduxComponents.async(prom).as('SOME_ASYNC_OPERATE').then((result)=>{
    console.log(result); // {test:29}
})
.catch(err => console.log)


// Callbacks

NodeReduxComponents.async(prom).as('SOME_ASYNC_OPERATE', (error, result)=>{
  console.log(result); // {test:29}
})
```

### Injecting custom state
Simular to a regular redux app, you can setup an **iniital state** using `NodeReduxComponents.injectState()` but this must be called before `NodeReduxComponents.create()`. Unlike a regular redux app, a root/global reducer will be created and/or merge with an existing root/global reduxer if using `NodeReduxComponents.bindReducerToState()`. 

```
const people = {
  list:[
    {firstName:'John', lastName:'Doe'}
    ]
}
NodeReduxComponents.injectState(people);
```

### Stateless components

In the cause you want to call function based on a event. You can use `NodeReduxComponents.stateless()` to create a bound function to a specific event fired.
Calling this function will return a UUID pointing to the reference to the function assigned. Calling `NodeReduxComponents.unbindStateless(componentUUID)` will unassigned the listener, if unassigned, this function will return `true` otherwise returns `false`

```

const component = NodeReduxComponents.stateless((eventState)=>{
  // code...
},{onEvent:'SOME_EVENT'});


let result = NodeReduxComponents.unbindStateless(component);

console.log(component); // some UUID
console.log(result); // true

```
### Direct event sending
You can directly send a event/action to a single component using `NodeReduxComponents.dispatchTo()` which also updates the application state/store without updating other components.

```
NodeReduxComponents.dispatchTo('MANAGER_COMPONENT',{payload:{test:true}});
```

### Component static references
Each component is "decorated" to extend its functionality. 

* **\_\_STATE__** - This is a reference to the localized state for the component being called.
* **\_\_BUILTIN__** - This allows access to the builtins interface per component as set using `NodeReduxComponents.addBuiltin()`
* **\_\_UPDATE_STORE__** - Similar to \_\_DISPATCH__, this function will update the app/store with the appropriate state.
* **\_\_ON_STATE_CHANGE__** - Is a method of the component, if set, any dispatch events will trigger the calling of this function in all **subscribed** components that have "dispatch events" enabled
* **\_\_DISPATCH__** - Is a function that can be called from within the context of the component to dispatch a event/action to the store/rest of app. 

### Extending functionality
Currently, Node-redux-components is built to be highly flexible. 

**Adding middleware**

Adding a middleware, also known as a  enhancer, allows you to create a "proxy" function that can be called before the app state/store is changed/updated. You can add custom middleware by using `NodeReduxComponents.addMiddleware()`. By default, there is no middleware enabled. If using *NodeReduxComponents.injectRemoteDevTools()*, this will add the necessary middle ware to enable the functionality for redux devTools extension.

```
const middleware = (store) => {
  return (next)=>{
    return (action)=> {
      const result = next(action);
      return result;
    };
  };
};

NodeReduxComponents.addMiddleware(middleware);
```

**Builtins**

You can add a "builtin" via `NodeReduxComponents.addBuiltin()` which is essentially binding a function outside of a component, even before its created, to be used inside the component using the \_\_BUILTIN__ reference. This could be used to easily add a API to an existing component.

```
class Manager{
  constructor(){
    this.___BUILTIN__.ajax.get('http://www.example.com').then(result => {
      console.log(result) // 'test'
    })
  }
}

NodeReduxComponents.addBuiltin('ajax', {
  get(arg){
    return new Promise((resolve)=>{
      resolve('test');
    })
  }
});

const component = NodeReduxComponents.addComponent(Manager);

```

**Component list**

Using `NodeReduxComponents.componentList()` will return a `string array` of the names of the components subscribed/added to NodeReduxComponents. 

**Adjusting Component static references**

The references used to decorate a component can be customized during the setup phase of Node-redux-components in case there are conflicts with the default references.
The usage of `NodeReduxComponents.setup()` comes before `NodeReduxComponents.create()`.

```
NodeReduxComponents.setup({
  component:{
    stateRef:'__CUSTOM_STATE__',
    builtInRef:'__CUSTOM_BUILTIN__',
    emitterRef: '__CUSTOM_UPDATE_STORE__',
    listenerRef:'__CUSTOM_ON_STATE_CHANGE__',
    dispatchRef:'__CUSTOM_DISPATCH__'
  }
});
```


### Converting an app to use Node-redux-components
Converting an existing nodejs app is fairly straight forwards. There are 2 prerequisites that are need for the transistion to be seamless
1. All exports functions or class are "named".
2. Existing state of exported function is kept in one place already whether locally or as a stand alone module