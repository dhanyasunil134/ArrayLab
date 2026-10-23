
document.addEventListener("DOMContentLoaded", () => {
    const sourceCode = document.getElementById("sourceCode");
    const lineNumbers = document.getElementById("lineNumbers");
    const lineCount = document.getElementById("lineCount");
    const editorInfo = document.getElementById("editorInfo");

    const compileBtn = document.getElementById("compileBtn");
    const clearBtn = document.getElementById("clearBtn");
    const copyBtn = document.getElementById("copyBtn");
    const copyOutputBtn = document.getElementById("copyOutputBtn");

    const exampleSelect = document.getElementById("exampleSelect");
    const output = document.getElementById("output");
    const status = document.getElementById("status");
    const resultMessage = document.getElementById("resultMessage");

    const symbolTable = document.getElementById("symbolTable");
    const syntaxTree = document.getElementById("syntaxTree");

    const examples = {
        valid:
            "int marks[5];\nfloat prices[3];\nchar letters[10];",

        bounds:
            "int marks[0];",

        syntax:
            "int marks[5]",

        invalid:
            "int marks[5]@;"
    };

    /* Safely display text inside HTML */

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    /* Update line numbers and editor information */

    function updateEditorInfo() {
        const count = sourceCode.value.split("\n").length;

        lineNumbers.textContent = Array.from(
            { length: count },
            (_, index) => index + 1
        ).join("\n");

        lineCount.textContent =
            `${count} ${count === 1 ? "line" : "lines"}`;

        editorInfo.textContent =
            `${sourceCode.value.length} characters`;
    }

    /* Reset compilation stages */

    function resetPipeline() {
        [
            "lexicalStep",
            "syntaxStep",
            "semanticStep",
            "resultStep"
        ].forEach(id => {
            const step = document.getElementById(id);

            step.classList.remove("done", "failed");

            step.querySelector(".stage-status").textContent =
                "Waiting";
        });
    }

    /* Update a compilation stage */

    function setStage(id, state, message) {
        const step = document.getElementById(id);

        step.classList.remove("done", "failed");

        if (state) {
            step.classList.add(state);
        }

        step.querySelector(".stage-status").textContent = message;
    }

    /* Display overall compilation status */

    function setResult(success, message) {
        status.textContent = success ? "Success" : "Failed";

        status.className =
            `result-badge ${success ? "success" : "error"}`;

        resultMessage.textContent = message;
    }

    /* =====================================
       SYNTAX TREE GENERATION
       ===================================== */

    /*
       Supported declaration format:
       int marks[5];
       float prices[3];

       Tree structure:
                   Program
                      |
              Array Declaration
                /     |      \
              Type   Name    Size
    */

    function renderSyntaxTree(source) {
        const lines = source.split(/\r?\n/);
        const declarations = [];
        const errors = [];

        const declarationPattern =
            /^\s*(int|float|char|double)\s+([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*;\s*$/;

        lines.forEach((line, index) => {
            if (!line.trim()) {
                return;
            }

            const match = line.match(declarationPattern);

            if (match) {
                declarations.push({
                    type: match[1],
                    name: match[2],
                    size: match[3],
                    line: index + 1
                });
            } else {
                errors.push({
                    text: line.trim(),
                    line: index + 1
                });
            }
        });

        if (declarations.length === 0 && errors.length === 0) {
            syntaxTree.innerHTML =
                '<p class="tree-message">Enter code to generate a syntax tree.</p>';
            return;
        }

        /*
          Create a tree node with optional child nodes.
          Children are nested inside their parent node.
        */

        function createNode(label, children = [], extraClass = "") {
            const childHTML = children.length
                ? `
                    <div class="tree-children">
                        ${children.join("")}
                    </div>
                  `
                : "";

            return `
                <div class="tree-node">
                    <div class="tree-box ${extraClass}">
                        ${escapeHTML(label)}
                    </div>
                    ${childHTML}
                </div>
            `;
        }

        /* Create a branch for each array declaration */

        const declarationNodes = declarations.map(declaration => {
            const detailNodes = [
                createNode(
                    `Type: ${declaration.type}`,
                    [],
                    "tree-leaf"
                ),

                createNode(
                    `Name: ${declaration.name}`,
                    [],
                    "tree-leaf"
                ),

                createNode(
                    `Size: ${declaration.size}`,
                    [],
                    "tree-leaf"
                )
            ];

            const declarationNode = createNode(
                "Array Declaration",
                detailNodes
            );

            const lineNode = createNode(
                `Line ${declaration.line}`,
                [],
                "tree-leaf"
            );

            /*
              Place the declaration and its source line
              under a separate branch.
            */

            return createNode(
                `Declaration ${declaration.line}`,
                [
                    declarationNode,
                    lineNode
                ]
            );
        });

        /* Add unmatched lines so they remain visible */

        const errorNodes = errors.map(error => {
            return createNode(
                `Invalid: Line ${error.line}`,
                [
                    createNode(
                        error.text,
                        [],
                        "tree-error"
                    )
                ]
            );
        });

        const allNodes = [...declarationNodes, ...errorNodes];

        /* Program is the root of the syntax tree */

        syntaxTree.innerHTML = `
            <div class="tree-node">
                <div class="tree-box tree-root">Program</div>

                <div class="tree-children">
                    ${allNodes.join("")}
                </div>
            </div>
        `;
    }

    /* =====================================
       SYMBOL TABLE
       ===================================== */

    function renderSymbolTable(compilerOutput) {
        const symbols = compilerOutput
            .split(/\r?\n/)
            .filter(line => line.startsWith("SYMBOL|"))
            .map(line => {
                const parts = line.split("|");

                return {
                    name: parts[1] || "",
                    type: parts[2] || "",
                    size: parts[3] || ""
                };
            });

        if (symbols.length === 0) {
            symbolTable.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-cell">
                        No array symbols found.
                    </td>
                </tr>
            `;
            return;
        }

        symbolTable.innerHTML = symbols.map(symbol => `
            <tr>
                <td>${escapeHTML(symbol.name)}</td>
                <td>${escapeHTML(symbol.type)}</td>
                <td>${escapeHTML(symbol.size)}</td>
            </tr>
        `).join("");
    }

    /* Clear previous results */

    function clearResults() {
        output.textContent =
            "Compiler output will appear here...";

        symbolTable.innerHTML = `
            <tr>
                <td colspan="3" class="empty-cell">
                    Compile code to view symbols.
                </td>
            </tr>
        `;

        syntaxTree.innerHTML = `
            <p class="tree-message">
                Compile your code to view the syntax tree.
            </p>
        `;

        resetPipeline();

        status.textContent = "Ready";
        status.className = "result-badge";

        resultMessage.textContent =
            "Enter your code and click Compile Code.";
    }

    /* =====================================
       COMPILE SOURCE CODE
       ===================================== */

    async function compileCode() {
        const code = sourceCode.value;

        if (!code.trim()) {
            output.textContent =
                "Please enter some C code first.";

            setResult(false, "No source code provided.");
            renderSyntaxTree("");
            return;
        }

        compileBtn.disabled = true;
        compileBtn.textContent = "Compiling...";

        resetPipeline();

        setResult(
            false,
            "Sending source code to the compiler..."
        );

        output.textContent = "Compiling source code...";

        /*
          Generate the visual tree from the editor.
          The server separately performs actual compilation.
        */

        renderSyntaxTree(code);

        try {
            const response = await fetch("/compile", {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain; charset=UTF-8"
                },
                body: code
            });

            const compilerOutput = await response.text();

            output.textContent = compilerOutput;

            if (!response.ok) {
                throw new Error(
                    compilerOutput ||
                    `Server returned ${response.status}`
                );
            }

            const success =
                compilerOutput.includes(
                    "RESULT: Compilation successful!"
                ) ||
                compilerOutput.includes(
                    "Compilation successful."
                );

            const lexicalError =
                /LEXICAL ERROR/i.test(compilerOutput);

            const syntaxError =
                /syntax error|unexpected/i.test(compilerOutput);

            const semanticError =
                /SEMANTIC ERROR/i.test(compilerOutput);

            if (success) {
                setStage("lexicalStep", "done", "Complete");
                setStage("syntaxStep", "done", "Complete");
                setStage("semanticStep", "done", "Complete");
                setStage("resultStep", "done", "Passed");

                setResult(
                    true,
                    "Compilation completed successfully."
                );
            } else {
                setStage(
                    "lexicalStep",
                    lexicalError ? "failed" : "done",
                    lexicalError ? "Error" : "Processed"
                );

                setStage(
                    "syntaxStep",
                    syntaxError ? "failed" : "done",
                    syntaxError ? "Error" : "Processed"
                );

                setStage(
                    "semanticStep",
                    semanticError ? "failed" : "done",
                    semanticError ? "Error" : "Processed"
                );

                setStage("resultStep", "failed", "Failed");

                setResult(
                    false,
                    "Compilation failed. Check the compiler output."
                );
            }

            renderSymbolTable(compilerOutput);

        } catch (error) {
            output.textContent =
                "Could not connect to the compiler server.\n\n" +
                "Make sure server.exe is running and refresh the page.\n\n" +
                "Details: " + error.message;

            resetPipeline();

            setStage("resultStep", "failed", "Error");

            setResult(
                false,
                "Unable to reach the compiler server."
            );
        } finally {
            compileBtn.disabled = false;
            compileBtn.textContent = "▶ Compile Code";
        }
    }

    /* =====================================
       EVENT LISTENERS
       ===================================== */

    sourceCode.addEventListener("input", updateEditorInfo);

    sourceCode.addEventListener("scroll", () => {
        lineNumbers.scrollTop = sourceCode.scrollTop;
    });

    sourceCode.addEventListener("keydown", event => {
        if (event.key === "Tab") {
            event.preventDefault();

            const start = sourceCode.selectionStart;
            const end = sourceCode.selectionEnd;

            sourceCode.setRangeText(
                "    ",
                start,
                end,
                "end"
            );

            updateEditorInfo();
        }

        if (
            (event.ctrlKey || event.metaKey) &&
            event.key === "Enter"
        ) {
            event.preventDefault();
            compileCode();
        }
    });

    compileBtn.addEventListener("click", compileCode);

    clearBtn.addEventListener("click", () => {
        sourceCode.value = "";

        updateEditorInfo();
        clearResults();

        sourceCode.focus();
    });

    copyBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(sourceCode.value);
            editorInfo.textContent = "Code copied!";
        } catch {
            editorInfo.textContent =
                "Copy failed. Select and copy manually.";
        }
    });

    copyOutputBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(
                output.textContent
            );

            copyOutputBtn.textContent = "Copied!";

            window.setTimeout(() => {
                copyOutputBtn.textContent = "Copy Output";
            }, 1500);
        } catch {
            copyOutputBtn.textContent = "Copy failed";
        }
    });

    exampleSelect.addEventListener("change", () => {
        const example = examples[exampleSelect.value];

        if (example !== undefined) {
            sourceCode.value = example;

            updateEditorInfo();
            clearResults();
        }
    });

    /* Initial setup */

    updateEditorInfo();
});
