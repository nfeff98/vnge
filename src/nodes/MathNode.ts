import { BaseNode } from '../core/BaseNode';
import { Calculator } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';

export class MathNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'Math',
      isInput: false,
      icon: Calculator,
      color: '#2196F3',
      backgroundColor: '#1a1a1a',
      borderColor: '#2196F3'
    });
  }

  getNodeDefinition() {
    return {
      type: 'math',
      inputs: ['a', 'b'],
      outputs: ['result'],
      parameters: {
        operation: {
          type: NodeParameterType.ENUM,
          value: 'add',
          options: [
            // Arithmetic
            'add',
            'subtract',
            'multiply',
            'divide',
            'modulo',
            'pow',
            
            // Trigonometry (radians)
            'sin',
            'cos',
            'tan',
            'asin',
            'acos',
            'atan',
            'atan2',
            
            // Rounding
            'floor',
            'ceil',
            'round',
            
            // Other
            'min',
            'max',
            'abs',
            'sqrt',
            'log',
            'exp'
          ]
        },
        a: { type: NodeParameterType.NUMBER, value: 0, step: 0.1 },
        b: { type: NodeParameterType.NUMBER, value: 0, step: 0.1 }
      },
      maxInputs: 2,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const operation = this.getParameter('operation') as string;
    const a = (this.getInput('a') as number) ?? (this.getParameter('a') as number);
    const b = (this.getInput('b') as number) ?? (this.getParameter('b') as number);

    let result: number;

    switch (operation) {
      // Arithmetic
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        result = a / b;
        break;
      case 'modulo':
        result = a % b;
        break;
      case 'pow':
        result = Math.pow(a, b);
        break;

      // Trigonometry (uses input 'a')
      case 'sin':
        result = Math.sin(a);
        break;
      case 'cos':
        result = Math.cos(a);
        break;
      case 'tan':
        result = Math.tan(a);
        break;
      case 'asin':
        result = Math.asin(a);
        break;
      case 'acos':
        result = Math.acos(a);
        break;
      case 'atan':
        result = Math.atan(a);
        break;
      case 'atan2':
        result = Math.atan2(a, b);
        break;

      // Rounding (uses input 'a')
      case 'floor':
        result = Math.floor(a);
        break;
      case 'ceil':
        result = Math.ceil(a);
        break;
      case 'round':
        result = Math.round(a);
        break;

      // Other
      case 'min':
        result = Math.min(a, b);
        break;
      case 'max':
        result = Math.max(a, b);
        break;
      case 'abs':
        result = Math.abs(a);
        break;
      case 'sqrt':
        result = Math.sqrt(a);
        break;
      case 'log':
        result = Math.log(a);
        break;
      case 'exp':
        result = Math.exp(a);
        break;

      default:
        result = 0;
    }

    this.setOutput('result', result as any);
  }

  cleanup() {
    // Nothing to cleanup
  }
}

