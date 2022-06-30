import './App.css';
import Variable from './variable/variable.js'
import {additive, VariableModifier} from './variable/modifier.js'
import Timer from './timer.js'

function App() {
  
  return (
    <div>
      <Variable startingValue={5} modifiers={[<VariableModifier value={<Variable startingValue={3} type={additive}/>}/>]}/>
      <Timer />
    </div>
  );
}

export default App;
