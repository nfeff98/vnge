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

    flipHorizontal(ctx: CanvasRenderingContext2D, inputElement: HTMLCanvasElement | HTMLVideoElement, width: number, height: number) {
        if (!ctx || !inputElement) {
            return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-width, 0);
        ctx.drawImage(inputElement, 0, 0);
        ctx.restore();
    }

    flipVertical(ctx: CanvasRenderingContext2D, inputElement: HTMLCanvasElement | HTMLVideoElement, width: number, height: number) {
        if (!ctx || !inputElement) {
            return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.scale(1, -1);
        ctx.translate(0, -height);
        ctx.drawImage(inputElement, 0, 0);
        ctx.restore();
    }

    async executeInternal(): Promise<void> {
        const inputElement = this.getInput('image');
        if (!inputElement) {
            return;
        }

        // Handle both HTMLVideoElement and HTMLCanvasElement inputs
        let inputWidth: number, inputHeight: number;
        if (inputElement instanceof HTMLVideoElement) {
            inputWidth = inputElement.videoWidth;
            inputHeight = inputElement.videoHeight;
        } else if (inputElement instanceof HTMLCanvasElement) {
            inputWidth = inputElement.width;
            inputHeight = inputElement.height;
        } else {
            return;
        }

        const outputCanvas = this.createCanvas(inputWidth, inputHeight);
        const ctx = outputCanvas.getContext('2d');
        if (!ctx) {
            return;
        }

        if (this.getParameter('axis') === 'horizontal') {
            this.flipHorizontal(ctx, inputElement, inputWidth, inputHeight);
        } else {
            this.flipVertical(ctx, inputElement, inputWidth, inputHeight);
        }

        this.setOutput('image', outputCanvas);
    }

    cleanup() {
        // any cleanup you need
    }


}