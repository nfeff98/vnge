# 🎨 Visual Node Graph Editor

Built by Nick Feffer
Copyright 2025

A browser-based visual programming platform inspired by TouchDesigner, designed for real-time camera processing and creative visual effects. Build complex visual pipelines by connecting nodes in an intuitive drag-and-drop interface.

## ✨ Features

- **🎥 Real-time Camera Processing**: Live camera feed with MediaPipe hand tracking
- **🔗 Visual Node Editor**: Drag-and-drop interface with React Flow
- **⚡ Pipeline Engine**: Asynchronous execution with proper dependency management
- **🎯 Smart Validation**: Connection limits and path validation
- **🖼️ Live Preview**: Real-time output with error overlays
- **📱 Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🌐 GitHub Pages Deployment

This project is configured for automatic deployment to GitHub Pages.

### Automatic Deployment (Recommended)

1. **Push to GitHub**: Simply push your changes to the `main` branch
2. **GitHub Actions**: The workflow automatically builds and deploys your site
3. **Access**: Your site will be available at `https://yourusername.github.io/vnge/`

### Manual Deployment

```bash
# Install gh-pages if not already installed
npm install --save-dev gh-pages

# Deploy manually
npm run deploy
```

### Setup Instructions

1. **Enable GitHub Pages**:
   - Go to your repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` (created automatically)
   - Folder: `/ (root)`

2. **Configure Repository**:
   - Ensure your repository is public (required for free GitHub Pages)
   - The GitHub Actions workflow will handle the rest automatically

3. **Custom Domain** (Optional):
   - Add a `CNAME` file to the `public/` folder with your domain
   - Configure DNS settings as per GitHub Pages documentation

## 🏗️ Architecture

### Core Components

- **Pipeline Engine** (`src/core/`): Manages node execution and dependencies
- **Node System** (`src/nodes/`): Individual processing nodes (Camera, Hand Tracking, Output)
- **Visual Editor** (`src/components/NodeEditor/`): React Flow-based node editor
- **Camera Management** (`src/hooks/useCamera.ts`): Camera stream handling

### Node Types

| Node | Inputs | Outputs | Description |
|------|--------|---------|-------------|
| 📹 Camera | 0 | 1 | Captures live video feed |
| ✋ Hand Tracking | 1 | 1 | MediaPipe hand detection and tracking |
| 🖼️ Output | 1 | 0 | Displays final result |

## 📋 Implementation Phases

### Phase 1: Foundation ✅
- [x] **Core Pipeline Engine**
  - [x] BaseNode abstract class with visual configuration
  - [x] PipelineEngine with topological sorting
  - [x] Node input/output management
  - [x] Asynchronous execution system

- [x] **Basic Node Types**
  - [x] CameraNode - Live video capture
  - [x] HandTrackingNode - MediaPipe integration
  - [x] OutputNode - Canvas rendering

- [x] **Camera Integration**
  - [x] useCamera hook for stream management
  - [x] HTTPS/localhost camera access
  - [x] Error handling and retry logic

### Phase 2: Visual Editor ✅
- [x] **React Flow Integration**
  - [x] Drag-and-drop node editor
  - [x] Connection handling
  - [x] Node positioning and layout

- [x] **Generic Node Component**
  - [x] Single component for all node types
  - [x] Visual configuration system
  - [x] Input/output handle rendering
  - [x] Connection count display

- [x] **Context Menu System**
  - [x] Right-click node management
  - [x] Add/delete nodes and connections
  - [x] Visual feedback and restrictions

### Phase 3: Pipeline Validation ✅
- [x] **Connection Limits**
  - [x] Max inputs/outputs per node
  - [x] Real-time validation
  - [x] Visual indicators (FULL status)

- [x] **Path Validation**
  - [x] Camera → Output path checking
  - [x] Graph traversal algorithm
  - [x] Flexible routing support

- [x] **Error Management**
  - [x] Pipeline error detection
  - [x] Error overlay on preview
  - [x] Status panel integration

### Phase 4: Advanced Features ✅
- [x] **Smart Pipeline Control**
  - [x] Auto-start/stop based on connections
  - [x] Immediate execution on changes
  - [x] Error recovery and clearing

- [x] **Output Node Protection**
  - [x] Prevent multiple output nodes
  - [x] Prevent output node deletion
  - [x] Pipeline stops when output removed

- [x] **MediaPipe Integration**
  - [x] Proper async/await handling
  - [x] Timeout protection
  - [x] Pipeline dependency respect

## 🎯 Future Enhancements

### Phase 5: Extended Node Library
- [ ] **Image Processing Nodes**
  - [ ] Sobel edge detection
  - [ ] Gaussian blur
  - [ ] Color manipulation
  - [ ] Geometric transforms

- [ ] **3D Rendering Nodes**
  - [ ] Three.js integration
  - [ ] 3D object rendering
  - [ ] Lighting and materials
  - [ ] Post-processing effects

- [ ] **AI/ML Nodes**
  - [ ] Local ONNX model support
  - [ ] Style transfer
  - [ ] Object detection
  - [ ] Pose estimation

### Phase 6: Advanced Editor Features
- [ ] **Node Parameters**
  - [ ] Real-time parameter panels
  - [ ] Slider controls
  - [ ] Color pickers
  - [ ] File uploads

- [ ] **Save/Load System**
  - [ ] JSON pipeline serialization
  - [ ] Project management
  - [ ] Export/import functionality

- [ ] **Performance Optimization**
  - [ ] WebGL acceleration
  - [ ] Worker threads
  - [ ] Memory management
  - [ ] Frame rate control

### Phase 7: Collaboration & Sharing
- [ ] **Real-time Collaboration**
  - [ ] Multi-user editing
  - [ ] Live cursors
  - [ ] Conflict resolution

- [ ] **Sharing Platform**
  - [ ] Public gallery
  - [ ] Fork/remix functionality
  - [ ] Community features

## 🛠️ Technical Stack

- **Frontend**: React 19 + TypeScript
- **Node Editor**: React Flow (@xyflow/react)
- **Camera**: MediaDevices API + MediaPipe
- **Build Tool**: Vite
- **Styling**: Inline CSS (modular approach)

## 📁 Project Structure

```
src/
├── components/
│   └── NodeEditor/
│       ├── NodeEditor.tsx          # Main editor component
│       ├── NodeComponent.tsx       # Generic node renderer
│       └── ContextMenu.tsx         # Right-click menu
├── core/
│   ├── BaseNode.ts                 # Abstract node class
│   ├── PipelineEngine.ts           # Execution engine
│   └── NodeRegistry.ts             # Node type management
├── nodes/
│   ├── CameraNode.ts               # Camera input
│   ├── HandTrackingNode.ts         # MediaPipe processing
│   └── OutputNode.ts               # Canvas output
├── hooks/
│   └── useCamera.ts                # Camera management
└── utils/
    ├── canvasUtils.ts              # Canvas utilities
    └── nodeUtils.ts                # Node helpers
```

## 🎮 Usage

### Basic Pipeline
1. **Add Camera Node**: Right-click empty space → Camera
2. **Add Output Node**: Right-click empty space → Output  
3. **Connect**: Drag from camera output to output input
4. **View Result**: Live camera feed appears in preview

### Hand Tracking Pipeline
1. **Add Camera Node**: Source of video data
2. **Add Hand Tracking Node**: MediaPipe processing
3. **Add Output Node**: Final display
4. **Connect**: Camera → Hand Tracking → Output
5. **View Result**: Hand tracking overlay on camera feed

### Advanced Workflows
- **Multiple Processing**: Chain multiple effect nodes
- **Parallel Processing**: Split camera feed to multiple processors
- **Conditional Logic**: Use different paths based on conditions

## 🔧 Development

### Adding New Node Types

1. **Create Node Class**:
```typescript
export class MyNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'My Node',
      icon: '🔧',
      color: '#FF6B6B',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF6B6B'
    });
  }

  getNodeDefinition() {
    return {
      type: 'myNode',
      inputs: ['input'],
      outputs: ['output'],
      parameters: {},
      maxInputs: 1,
      maxOutputs: 1
    };
  }

  async execute(): Promise<void> {
    // Your processing logic here
  }
}
```

2. **Add to Context Menu**:
```typescript
const nodeTypes = [
  { type: 'myNode', name: 'My Node', icon: '🔧' },
  // ... existing types
];
```

3. **Register in Pipeline**:
```typescript
// In NodeEditor.tsx
case 'myNode':
  pipelineNode = new MyNode(nodeId);
  break;
```

### Performance Tips

- **Limit Frame Rate**: Adjust execution frequency for heavy processing
- **Canvas Optimization**: Reuse canvas elements when possible
- **Memory Management**: Clean up resources in node cleanup methods
- **Async Processing**: Use proper async/await patterns

## 🐛 Troubleshooting

### Common Issues

**Camera Not Working**:
- Ensure HTTPS or localhost
- Check camera permissions
- Close other camera applications

**Pipeline Not Running**:
- Verify camera → output path exists
- Check for connection errors
- Ensure output node is present

**Hand Tracking Issues**:
- Wait for MediaPipe initialization
- Check camera feed quality
- Verify proper lighting

### Debug Mode

Enable debug logging:
```typescript
// In NodeEditor.tsx
console.log('Pipeline execution:', { isExecuting, hasValidPath });
```

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 🙏 Acknowledgments

- **MediaPipe**: Google's hand tracking technology
- **React Flow**: Node editor framework
- **TouchDesigner**: Inspiration for visual programming
- **Three.js**: 3D graphics library (future integration)

---

**Built with ❤️ for the creative coding community**

*This project represents a complete visual programming platform, from basic camera capture to advanced pipeline processing. The modular architecture makes it easy to extend with new node types and processing capabilities.*