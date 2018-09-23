# Node-redux
*Node-redux* is state management library designed for nodejs applications in mind. 
With Redux at its core, node-redux is designed to integrate an existing nodejs application with ease with the benefits of Redux architecure and state management.

## Install
```
npm run install node-redux
```

## Usage

**Setup**

Setup is similar to a regular Redux application but in node-redux this works slightly different

```
const NodeRedux = require('node-redux');

NodeRedux.setup();

NodeRedux.bindReducerToState({
  someReducer: yourReducerHere,
});

let store = NodeRedux.create();
```
**Components**

Components can be thought of as "modules" in that once registered with node-redux, the **component** will be decorated with extended functionality.
Once decorated with `addComponent`, the class/function can be treated normally(you dont need to change/adjust the arguments arguments)

**Note:** Components MUST be named functions/classes

```
// module2.js
const NodeRedux = require('node-redux');
class Manager{
  constructor(){

  }
}
module.exports = NodeRedux.addComponent(Manager);

// in another file....
const Manager = require('./module2);

let manager = new Manager();

```