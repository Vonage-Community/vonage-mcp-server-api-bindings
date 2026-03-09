// src/mcp-app.ts
import { App } from "@modelcontextprotocol/ext-apps";

// Initialize the MCP App connection
const app = new App({ name: "Chart App", version: "1.0.0" });

// Global state
let currentChart: any = null; // Store the Chart.js instance
let currentFilename = "chart";

// DOM Elements
const canvas = document.getElementById("myChart") as HTMLCanvasElement;
const downloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement;
const copyBtn = document.getElementById("copyBtn") as HTMLButtonElement;
const errorMsg = document.getElementById("error-message") as HTMLDivElement;

// Connect to the MCP Host (e.g., Claude Desktop, basic-host)
app.connect();

// Listen for tool results pushed from the host
app.ontoolresult = (result) => {
    try {
        errorMsg.textContent = ""; // Clear previous errors
        
        // 1. Extract the text content from the tool result
        const textContent = result.content?.find((c) => c.type === "text")?.text;
        if (!textContent) {
            throw new Error("No text content found in tool result.");
        }

        // 2. Parse the JSON sent by the LLM
        const args = JSON.parse(textContent);
        
        // 3. Update filename and validate config
        currentFilename = args.filename || "mcp_chart";
        if (!args.chartConfig) {
            throw new Error("Missing 'chartConfig' in the payload.");
        }

        // 4. Destroy existing chart if it exists (prevents overlapping rendering bugs)
        if (currentChart) {
            currentChart.destroy();
        }

        // 5. Render the new chart
        // @ts-ignore - Assuming Chart is loaded globally via CDN in HTML
        currentChart = new Chart(canvas, {
            ...args.chartConfig,
            plugins: [
                ...(args.chartConfig.plugins || []),
                // Custom plugin: Fill background with white before rendering so downloads aren't transparent
                {
                    id: 'customCanvasBackgroundColor',
                    beforeDraw: (chart: any, args: any, options: any) => {
                        const { ctx } = chart;
                        ctx.save();
                        ctx.globalCompositeOperation = 'destination-over';
                        ctx.fillStyle = options.color || '#ffffff';
                        ctx.fillRect(0, 0, chart.width, chart.height);
                        ctx.restore();
                    }
                }
            ]
        });

        // 6. Enable the download and copy buttons
        downloadBtn.disabled = false;
        copyBtn.disabled = false;

    } catch (error: any) {
        console.error("Failed to render chart:", error);
        errorMsg.textContent = `Error rendering chart: ${error.message}`;
    }
};

downloadBtn.addEventListener("click", async () => {
    if (!currentChart) return;

    try {
        downloadBtn.textContent = "Saving...";
        downloadBtn.disabled = true;

        // 1. Build a safe filename (avoid double .png)
        let filename = currentFilename || "mcp_chart";
        if (!filename.toLowerCase().endsWith('.png')) filename = `${filename}.png`;

        // 2. Get the data URL and strip the prefix to send plain base64
        const dataUrl = currentChart.toBase64Image("image/png", 1);
        const commaIdx = dataUrl.indexOf(',');
        const base64String = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

        // 3. Call the new save_chart tool on your server with raw base64
        const result = await app.callServerTool({
            name: "save_chart",
            arguments: {
                filename,
                base64Data: base64String,
            },
        });

        // 3. Handle success
        downloadBtn.textContent = "Saved!";
        setTimeout(() => {
            downloadBtn.textContent = "Download Chart";
            downloadBtn.disabled = false;
        }, 3000);

    } catch (error) {
        console.error("Failed to save chart:", error);
        downloadBtn.textContent = "Error Saving";
        errorMsg.textContent = "Could not save to disk.";
    }
});

// Helper function to convert canvas to a Blob
const getCanvasBlob = (canvasEl: HTMLCanvasElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        canvasEl.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create image blob from canvas."));
        }, "image/png", 1);
    });
};

copyBtn.addEventListener("click", async () => {
    if (!currentChart) return;

    try {
        copyBtn.textContent = "Copying...";
        copyBtn.disabled = true;

        // 1. Get the image Blob from the canvas
        const blob = await getCanvasBlob(canvas);

        // 2. Write the Blob to the system clipboard
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);

        // 3. Show success state
        copyBtn.textContent = "Copied!";
        copyBtn.style.backgroundColor = "#28a745"; // Make it green for success
        
    } catch (error) {
        console.error("Clipboard write failed:", error);
        copyBtn.textContent = "Copy Failed";
        copyBtn.style.backgroundColor = "#dc3545"; // Red for error
    } finally {
        // Reset the button after 2.5 seconds
        setTimeout(() => {
            copyBtn.textContent = "Copy Chart to Clipboard";
            copyBtn.style.backgroundColor = "#0066cc";
            copyBtn.disabled = false;
        }, 2500);
    }
});