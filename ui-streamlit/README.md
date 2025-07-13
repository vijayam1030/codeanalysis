# Code Analyzer Pro - Streamlit UI

A modern, beautiful Streamlit interface for the Code Analyzer application.

## Features

- 🎨 Modern, responsive design with gradient themes
- 📤 Drag-and-drop image upload
- 🔧 Multiple extraction methods
- 📊 Real-time analysis results
- 📚 Analysis history
- 🔒 Security issue detection
- ⚡ Performance analysis
- 💻 Syntax-highlighted code display

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
streamlit run app.py
```

3. Open your browser to `http://localhost:8501`

## Configuration

- **Backend URL**: Automatically connects to `http://localhost:5000/api`
- **Extraction Methods**: Dynamically loaded from backend
- **Analysis Prompt**: Customizable in the sidebar

## Usage

1. Select an extraction method from the sidebar
2. Customize the analysis prompt if needed
3. Upload an image containing code
4. Click "Analyze Code" to process
5. View detailed results with line-by-line analysis
6. Access previous analyses from the history panel

## Features Overview

### Image Upload
- Supports PNG, JPG, JPEG, GIF, BMP formats
- Real-time image preview
- File size and dimension information

### Analysis Results
- Code overview and metrics
- Line-by-line code analysis
- Security vulnerability detection
- Performance optimization suggestions
- Severity and category classifications

### Modern UI Elements
- Gradient headers and accent colors
- Card-based layout design
- Responsive column layouts
- Interactive expandable sections
- Status indicators and health checks

## Requirements

- Python 3.7+
- Backend server running on port 5000
- Internet connection for AI models