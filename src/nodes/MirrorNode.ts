import { BaseNode, NodeParameterType } from '../core/BaseNode';
import { FlipHorizontal } from 'lucide-react';

export class MirrorNode extends BaseNode {
    private outputCanvas: HTMLCanvasElement | null = null;
    // any private variables you need


    private axis: 'horizontal' | 'vertical' = 'vertical';
    constructor(id: string) {
        super(id, {
            name: 'Mirror',
            icon: FlipHorizontal,
            color: '#FF9800',
            backgroundColor: '#1a1a1a',
            borderColor: '#FF9800'
        });
    }

    getNodeDefinition() {
        return {
            type: 'mirror',
            inputs: ['image'],
            outputs: ['image'],
            parameters: { axis: { type: NodeParameterType.ENUM, value: this.axis, options: ['horizontal', 'vertical'] } },
            maxInputs: 1,
            maxOutputs: 1
        };
    }

    flipHorizontal(ctx: CanvasRenderingContext2D, inputCanvas: HTMLCanvasElement) {
        if (!ctx || !inputCanvas) {
            return;
        }
        ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-inputCanvas.width, 0);
        ctx.drawImage(inputCanvas, 0, 0);
        ctx.restore();
    }

    flipVertical(ctx: CanvasRenderingContext2D, inputCanvas: HTMLCanvasElement) {
        if (!ctx || !inputCanvas) {
            return;
        }
        ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
        ctx.save();
        ctx.scale(1, -1);
        ctx.translate(0, -inputCanvas.height);
        ctx.drawImage(inputCanvas, 0, 0);
        ctx.restore();
    }

    async executeInternal(): Promise<void> {
        const inputCanvas = this.getInput('image');
        if (!inputCanvas) {
            return;
        }

        const outputCanvas = this.createCanvas(inputCanvas.width, inputCanvas.height);
        const ctx = outputCanvas.getContext('2d');
        if (!ctx) {
            return;
        }

        if (this.getParameter('axis') === 'horizontal') {
            this.flipHorizontal(ctx, inputCanvas);
        } else {
            this.flipVertical(ctx, inputCanvas);
        }

        this.setOutput('image', outputCanvas);
    }

    cleanup() {
        // any cleanup you need
    }


}