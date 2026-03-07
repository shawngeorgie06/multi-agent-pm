import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .calculator {
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 320px;
        }

        .display {
            background: #f0f0f0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            text-align: right;
            font-size: 32px;
            font-weight: bold;
            min-height: 60px;
            word-wrap: break-word;
            color: #333;
        }

        .buttons {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
        }

        button {
            padding: 20px;
            font-size: 20px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            background: #f0f0f0;
            color: #333;
            font-weight: bold;
            transition: all 0.2s;
        }

        button:hover {
            background: #e0e0e0;
            transform: scale(1.05);
        }

        button:active {
            transform: scale(0.95);
        }

        .operator {
            background: #667eea;
            color: white;
        }

        .operator:hover {
            background: #5568d3;
        }

        .clear {
            background: #ff6b6b;
            color: white;
        }

        .clear:hover {
            background: #ee5a52;
        }

        .equals {
            background: #51cf66;
            color: white;
            grid-column: span 2;
        }

        .equals:hover {
            background: #40c057;
        }
    </style>
</head>
<body>
    <div class="calculator">
        <div class="display" id="display">0</div>
        <div class="buttons">
            <button class="clear" onclick="clearDisplay()">C</button>
            <button class="operator" onclick="appendOperator('/')">/</button>
            <button class="operator" onclick="appendOperator('*')">×</button>
            <button onclick="deleteChar()">⌫</button>

            <button onclick="appendNumber('7')">7</button>
            <button onclick="appendNumber('8')">8</button>
            <button onclick="appendNumber('9')">9</button>
            <button class="operator" onclick="appendOperator('-')">−</button>

            <button onclick="appendNumber('4')">4</button>
            <button onclick="appendNumber('5')">5</button>
            <button onclick="appendNumber('6')">6</button>
            <button class="operator" onclick="appendOperator('+')">+</button>

            <button onclick="appendNumber('1')">1</button>
            <button onclick="appendNumber('2')">2</button>
            <button onclick="appendNumber('3')">3</button>

            <button onclick="appendNumber('0')">0</button>
            <button onclick="appendNumber('.')">.</button>
            <button class="equals" onclick="calculate()">=</button>
        </div>
    </div>

    <script>
        let currentValue = '0';
        let previousValue = '';
        let operation = null;
        let shouldResetDisplay = false;

        function updateDisplay() {
            document.getElementById('display').textContent = currentValue;
        }

        function appendNumber(num) {
            if (shouldResetDisplay) {
                currentValue = num;
                shouldResetDisplay = false;
            } else {
                if (currentValue === '0' && num !== '.') {
                    currentValue = num;
                } else if (num === '.' && currentValue.includes('.')) {
                    return;
                } else {
                    currentValue += num;
                }
            }
            updateDisplay();
        }

        function appendOperator(op) {
            if (operation !== null) {
                calculate();
            }
            previousValue = currentValue;
            operation = op;
            shouldResetDisplay = true;
        }

        function calculate() {
            if (operation === null || shouldResetDisplay) return;

            const prev = parseFloat(previousValue);
            const current = parseFloat(currentValue);
            let result;

            switch(operation) {
                case '+':
                    result = prev + current;
                    break;
                case '-':
                    result = prev - current;
                    break;
                case '*':
                    result = prev * current;
                    break;
                case '/':
                    if (current === 0) {
                        currentValue = 'Error';
                        updateDisplay();
                        return;
                    }
                    result = prev / current;
                    break;
            }

            currentValue = String(result);
            operation = null;
            shouldResetDisplay = true;
            updateDisplay();
        }

        function clearDisplay() {
            currentValue = '0';
            previousValue = '';
            operation = null;
            shouldResetDisplay = false;
            updateDisplay();
        }

        function deleteChar() {
            if (currentValue.length > 1) {
                currentValue = currentValue.slice(0, -1);
            } else {
                currentValue = '0';
            }
            updateDisplay();
        }

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key >= '0' && e.key <= '9') appendNumber(e.key);
            if (e.key === '.') appendNumber('.');
            if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') appendOperator(e.key);
            if (e.key === 'Enter' || e.key === '=') calculate();
            if (e.key === 'Escape') clearDisplay();
            if (e.key === 'Backspace') deleteChar();
        });
    </script>
</body>
</html>`;

async function main() {
  await prisma.task.update({
    where: { id: 'fa4c6914-b030-457e-b774-70b3ce1b7c7f' },
    data: { generatedCode: html }
  });
  console.log('✅ Calculator updated successfully');
  await prisma.$disconnect();
}

main().catch(console.error);
