const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const video = document.getElementById('video'); //Elemento de vídeo que exibe o feed da câmera para a detecção de mãos
let model; //Modelo de detecção de mãos
let handDetected = false; //Variável de controle para indicar se uma mão foi detectada.

// Configuração inicial dos paddles, bola e pontuação
let paddle1 = { x: 10, y: 100, width: 20, height: 100, dy: 4 }; // Paddle controlado pela IA
let paddle2 = { x: 770, y: 100, width: 20, height: 100, dy: 0 }; // Paddle controlado pela mão aberta
let ball = { x: 400, y: 300, radius: 10, dx: 6, dy: 6 };
let score1 = 0; //pontuação da Inteligencia Artificial
let score2 = 0; //Pontuação do Jogador
let historico = { player1Wins: 0, player2Wins: 0 }; 
const winningScore = 5; //essa é a pontuação necessária para a Inteligencia Artificial
let gameOver = false; 

// Funções de detecção de mão
function isClosedFist(prediction) {
    return prediction.label === 'closed' && prediction.score > 0.8; // Ajuste conforme necessário
}

function isOpenHand(prediction) {
    return prediction.label === 'open'; // Ajuste conforme necessário
}

// Carrega o modelo de detecção de mãos e inicia o vídeo da câmera
async function initHandTrack() {
    model = await handTrack.load();
    console.log('carregando modelo HandTrack:', model);
    await startVideo();
}

// Inicia o vídeo da câmera para detecção de mão
async function startVideo() {
    const constraints = { video: true };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints); //solicita aceso a camera
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
            video.play();
            console.log('Vídeo iniciado');
            gameLoop(); // Inicia o loop do jogo após o vídeo começar
        });
    } catch (error) {
        console.error('Erro para acessar a câmera:', error); //essa mensagem aparece quando não conseguimos acessar a camera
    }
}

// Detecta mãos na área do vídeo e ajusta o paddle2 conforme necessário
async function detectHands() {
    if (!model || !video.srcObject) return; //caso as mãos ou o video não estiverem disponiveis o jogo não carrega

    try {
        const predictions = await model.detect(video); 
        console.log('Previsão:', predictions); 

        // Variáveis de controle para acompanhar se uma mão aberta ou punho fechado foram detectados.
        let detectedOpenHand = false; 
        let detectedClosedFist = false;

        predictions.forEach(prediction => {
            console.log(`Previsão: ${prediction.label}, Pontos: ${prediction.score}`); //Para cada previsão, imprime o rótulo (prediction.label) e a 
            //pontuação (prediction.score) no console.
            const hand = prediction.bbox;
            //Ponto Superior Y (hand[1]): Esta é a coordenada Y do canto superior esquerdo da caixa.
            //Altura da Caixa (hand[3]): Esta é a altura da caixa delimitadora.
            const handCenterY = hand[1] + hand[3] / 2; 

            //detectar a mão aberta
            if (prediction.label === 'open' && isOpenHand(prediction)) {
                detectedOpenHand = true;
                console.log('Mão aberta detectada:', hand);
                adjustPaddlePosition(handCenterY);
            }
            //detectar mão fechada (mesmo não tendo)
            if (prediction.label === 'closed' && isClosedFist(prediction)) {
                detectedClosedFist = true;
                console.log('Punho fechado detectado:', hand);
                adjustPaddlePosition(handCenterY);
            }
        });

        if (!detectedOpenHand && !detectedClosedFist) {
            paddle2.dy = 0; // Nenhuma mão detectada, parar o paddle
        }

    } catch (error) {
        console.error('Erro para detectar mãos:', error);
        paddle2.dy = 0; // Em caso de erro, parar o paddle
    }
}

// Ajusta a posição do paddle2 com base na posição da mão detectada
function adjustPaddlePosition(handCenterY) {
    const paddle2CenterY = paddle2.y + paddle2.height / 2;
    const sensitivity = 1; // Sensibilidade para suavizar o movimento

    // Calcula o movimento baseado na diferença entre a posição atual da mão e a posição anterior
    const handMovement = (handCenterY - paddle2CenterY) * sensitivity;

    // Limita a velocidade máxima de movimento do paddle2 para evitar travamentos
    paddle2.dy = Math.max(Math.min(handMovement, 8), -8);
}

// Loop principal do jogo
function gameLoop() {
    update();
    draw();
    detectHands();
    requestAnimationFrame(gameLoop);
}

// Atualiza a lógica do jogo
function update() {
    // Movimento do paddle1 (IA)
    if (ball.y < paddle1.y + paddle1.height / 2) {
        paddle1.y -= paddle1.dy;
    } else if (ball.y > paddle1.y + paddle1.height / 2) {
        paddle1.y += paddle1.dy;
    }

    // Limita o movimento do paddle1 dentro dos limites do canvas
    paddle1.y = Math.max(Math.min(paddle1.y, canvas.height - paddle1.height), 0);

    // Movimento do paddle2 (mão aberta)
    paddle2.y += paddle2.dy;
    paddle2.y = Math.max(Math.min(paddle2.y, canvas.height - paddle2.height), 0);

    // Atualiza a posição da bola
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Verifica colisão com as bordas superior e inferior do canvas
    if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
        ball.dy *= -1; // Inverte a direção vertical da bola
    }

    // Verifica colisão com o paddle1 (IA)
    if (ball.x - ball.radius < paddle1.x + paddle1.width &&
        ball.x - ball.radius > paddle1.x &&
        ball.y > paddle1.y - ball.radius &&
        ball.y < paddle1.y + paddle1.height + ball.radius) {
        ball.dx *= -1; // Inverte a direção horizontal da bola
    }

    // Verifica colisão com o paddle2 (mão aberta)
    if (ball.x + ball.radius > paddle2.x &&
        ball.x + ball.radius < paddle2.x + paddle2.width &&
        ball.y > paddle2.y - ball.radius &&
        ball.y < paddle2.y + paddle2.height + ball.radius) {
        ball.dx *= -1; // Inverte a direção horizontal da bola
    }

    // Verifica se a bola ultrapassou o lado direito do canvas (IA marca ponto)
    if (ball.x + ball.radius > canvas.width) {
        score1++;
        if (score1 >= winningScore && !gameOver) {
            gameOver = true;
            alert('Inteligência Artificial Ganhou!');
            historico.player1Wins++;
            resetarJogo();
        } else {
            resetBall(); // Reinicia a posição da bola
        }
    }

    // Verifica se a bola ultrapassou o lado esquerdo do canvas (O jogador (você ou eu) 2 marca ponto)
    if (ball.x - ball.radius < 0) {
        score2++;
        if (score2 >= winningScore && !gameOver) {
            gameOver = true;
            alert('Você ganhou da IA, parabéns!');
            historico.player2Wins++;
            resetarJogo();
        } else {
            resetBall(); // Reinicia a posição da bola
        }
    }
}

// Desenha os elementos do jogo no canvas
function draw() {
    // Limpa o canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Desenho do campo
    context.strokeStyle = '#FFF';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(canvas.width / 2, 0);
    context.lineTo(canvas.width / 2, canvas.height);
    context.stroke();

    // Desenha dos paddles
    context.fillStyle = '#FFF';
    context.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
    context.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);

    // Desenha da bola
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
    context.closePath();

    // Exibe a pontuação e histórico de vitórias
    context.font = '20px Arial';
    context.fillText(`Inteligência Artificial: ${score1}`, 50, 30);
    context.fillText(`Você: ${score2}`, canvas.width - 150, 30);
    context.font = '16px Arial';
    context.fillText(`Inteligência Artificial Ganhou: ${historico.player1Wins}`, 50, canvas.height - 20);
    context.fillText(`Voce ganhou: ${historico.player2Wins}`, canvas.width - 150, canvas.height - 20);
}

// Reiniciar a posição da bola no centro do canvas
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx *= -1; // Inverte a direção horizontal da bola
}

// Reiniciar o jogo para o estado inicial
function resetarJogo() {
    score1 = 0;
    score2 = 0;
    gameOver = false;
    resetBall(); // Reinicia a posição da bola
    // Reposiciona os paddles no centro do campo
    paddle1.y = canvas.height / 2 - paddle1.height / 2;
    paddle2.y = canvas.height / 2 - paddle2.height / 2;
}

// Event listeners para os botões de reinício
document.getElementById('resetarJogo').addEventListener('click', () => {
    resetarJogo();
});

document.getElementById('resetarHistorico').addEventListener('click', () => {
    resetarHistorico();
    historico.player1Wins = 0;
    historico.player2Wins = 0;
});

document.getElementById('resetarTudo').addEventListener('click', () => {
    resetarJogo();
    resetarHistorico();
    score1 = 0;
    score2 = 0;
    historico.player1Wins = 0;
    historico.player2Wins = 0;
    resetBall();
});

// Inicia o jogo quando o DOM (Document Object Model) estiver completamente carregado
document.addEventListener('DOMContentLoaded', () => {
    initHandTrack();
});
