const boardElement = document.getElementById("board");
const turnStatus = document.getElementById("turn-status");
const positionStatus = document.getElementById("position-status");
const moveCount = document.getElementById("move-count");
const gameMessage = document.getElementById("game-message");
const pieceSymbols = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const initialPosition = () => ({
  board: [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    Array(8).fill("p"),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill("P"),
    ["R", "N", "B", "Q", "K", "B", "N", "R"],
  ],
  turn: "w",
  castle: { K: true, Q: true, k: true, q: true },
  enPassant: null,
  moves: 0,
  selected: null,
  legalMoves: [],
  lastMove: null,
});

let game = initialPosition();

function colorOf(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? "w" : "b";
}

function inside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function findKing(position, color) {
  const king = color === "w" ? "K" : "k";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (position.board[row][col] === king) return { row, col };
    }
  }
  return null;
}

function isAttacked(position, row, col, byColor) {
  const pawnRow = row + (byColor === "w" ? 1 : -1);
  const pawn = byColor === "w" ? "P" : "p";
  for (const pawnCol of [col - 1, col + 1]) {
    if (inside(pawnRow, pawnCol) && position.board[pawnRow][pawnCol] === pawn) return true;
  }

  const knight = byColor === "w" ? "N" : "n";
  for (const [rowStep, colStep] of [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ]) {
    const targetRow = row + rowStep;
    const targetCol = col + colStep;
    if (inside(targetRow, targetCol) && position.board[targetRow][targetCol] === knight) return true;
  }

  const king = byColor === "w" ? "K" : "k";
  for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
    for (let colStep = -1; colStep <= 1; colStep += 1) {
      if (!rowStep && !colStep) continue;
      const targetRow = row + rowStep;
      const targetCol = col + colStep;
      if (inside(targetRow, targetCol) && position.board[targetRow][targetCol] === king) return true;
    }
  }

  const directions = [
    [-1, 0, ["r", "q"]], [1, 0, ["r", "q"]],
    [0, -1, ["r", "q"]], [0, 1, ["r", "q"]],
    [-1, -1, ["b", "q"]], [-1, 1, ["b", "q"]],
    [1, -1, ["b", "q"]], [1, 1, ["b", "q"]],
  ];
  for (const [rowStep, colStep, attackers] of directions) {
    let targetRow = row + rowStep;
    let targetCol = col + colStep;
    while (inside(targetRow, targetCol)) {
      const piece = position.board[targetRow][targetCol];
      if (piece) {
        if (colorOf(piece) === byColor && attackers.includes(piece.toLowerCase())) return true;
        break;
      }
      targetRow += rowStep;
      targetCol += colStep;
    }
  }
  return false;
}

function inCheck(position, color) {
  const king = findKing(position, color);
  return king ? isAttacked(position, king.row, king.col, color === "w" ? "b" : "w") : false;
}

function addMove(moves, position, fromRow, fromCol, toRow, toCol, extra = {}) {
  if (!inside(toRow, toCol)) return;
  const target = position.board[toRow][toCol];
  const movingPiece = position.board[fromRow][fromCol];
  if (target && (colorOf(target) === colorOf(movingPiece) || target.toLowerCase() === "k")) return;
  moves.push({ fromRow, fromCol, toRow, toCol, ...extra });
}

function pseudoMoves(position, row, col) {
  const piece = position.board[row][col];
  if (!piece) return [];
  const color = colorOf(piece);
  const type = piece.toLowerCase();
  const moves = [];
  const step = color === "w" ? -1 : 1;

  if (type === "p") {
    const nextRow = row + step;
    if (inside(nextRow, col) && !position.board[nextRow][col]) {
      addMove(moves, position, row, col, nextRow, col);
      const startRow = color === "w" ? 6 : 1;
      const doubleRow = row + step * 2;
      if (row === startRow && !position.board[doubleRow][col]) {
        addMove(moves, position, row, col, doubleRow, col);
      }
    }
    for (const targetCol of [col - 1, col + 1]) {
      if (!inside(nextRow, targetCol)) continue;
      const target = position.board[nextRow][targetCol];
      if (target && colorOf(target) !== color && target.toLowerCase() !== "k") {
        addMove(moves, position, row, col, nextRow, targetCol);
      } else if (position.enPassant
        && position.enPassant.row === nextRow
        && position.enPassant.col === targetCol) {
        addMove(moves, position, row, col, nextRow, targetCol, { enPassant: true });
      }
    }
    return moves;
  }

  if (type === "n") {
    for (const [rowStep, colStep] of [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ]) addMove(moves, position, row, col, row + rowStep, col + colStep);
    return moves;
  }

  const directions = [];
  if (type === "b" || type === "q" || type === "k") {
    directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  }
  if (type === "r" || type === "q" || type === "k") {
    directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  }
  for (const [rowStep, colStep] of directions) {
    const sliding = type !== "k";
    let targetRow = row + rowStep;
    let targetCol = col + colStep;
    while (inside(targetRow, targetCol)) {
      const target = position.board[targetRow][targetCol];
      if (!target || (colorOf(target) !== color && target.toLowerCase() !== "k")) {
        addMove(moves, position, row, col, targetRow, targetCol);
      }
      if (target || !sliding) break;
      targetRow += rowStep;
      targetCol += colStep;
    }
  }

  if (type === "k" && !inCheck(position, color)) {
    const homeRow = color === "w" ? 7 : 0;
    const opponent = color === "w" ? "b" : "w";
    const kingSide = color === "w" ? "K" : "k";
    const queenSide = color === "w" ? "Q" : "q";
    if (row === homeRow && col === 4 && position.castle[kingSide]
      && position.board[homeRow][7] === (color === "w" ? "R" : "r")
      && !position.board[homeRow][5] && !position.board[homeRow][6]
      && !isAttacked(position, homeRow, 5, opponent)
      && !isAttacked(position, homeRow, 6, opponent)) {
      moves.push({ fromRow: row, fromCol: col, toRow: homeRow, toCol: 6, castle: "king" });
    }
    if (row === homeRow && col === 4 && position.castle[queenSide]
      && position.board[homeRow][0] === (color === "w" ? "R" : "r")
      && !position.board[homeRow][1] && !position.board[homeRow][2] && !position.board[homeRow][3]
      && !isAttacked(position, homeRow, 3, opponent)
      && !isAttacked(position, homeRow, 2, opponent)) {
      moves.push({ fromRow: row, fromCol: col, toRow: homeRow, toCol: 2, castle: "queen" });
    }
  }
  return moves;
}

function clonePosition(position) {
  return {
    board: position.board.map((row) => row.slice()),
    turn: position.turn,
    castle: { ...position.castle },
    enPassant: position.enPassant && { ...position.enPassant },
    moves: position.moves,
    selected: null,
    legalMoves: [],
    lastMove: position.lastMove,
  };
}

function applyMove(position, move) {
  const piece = position.board[move.fromRow][move.fromCol];
  const color = colorOf(piece);
  const captured = move.enPassant
    ? position.board[move.fromRow][move.toCol]
    : position.board[move.toRow][move.toCol];
  position.board[move.fromRow][move.fromCol] = null;
  if (move.enPassant) position.board[move.fromRow][move.toCol] = null;
  position.board[move.toRow][move.toCol] = piece;

  if (move.castle === "king") {
    position.board[move.toRow][5] = position.board[move.toRow][7];
    position.board[move.toRow][7] = null;
  } else if (move.castle === "queen") {
    position.board[move.toRow][3] = position.board[move.toRow][0];
    position.board[move.toRow][0] = null;
  }

  if (piece === "K") {
    position.castle.K = false;
    position.castle.Q = false;
  } else if (piece === "k") {
    position.castle.k = false;
    position.castle.q = false;
  }
  if (piece === "R" && move.fromRow === 7 && move.fromCol === 0) position.castle.Q = false;
  if (piece === "R" && move.fromRow === 7 && move.fromCol === 7) position.castle.K = false;
  if (piece === "r" && move.fromRow === 0 && move.fromCol === 0) position.castle.q = false;
  if (piece === "r" && move.fromRow === 0 && move.fromCol === 7) position.castle.k = false;
  if (captured === "R" && move.toRow === 7 && move.toCol === 0) position.castle.Q = false;
  if (captured === "R" && move.toRow === 7 && move.toCol === 7) position.castle.K = false;
  if (captured === "r" && move.toRow === 0 && move.toCol === 0) position.castle.q = false;
  if (captured === "r" && move.toRow === 0 && move.toCol === 7) position.castle.k = false;

  position.enPassant = null;
  if (piece.toLowerCase() === "p" && Math.abs(move.toRow - move.fromRow) === 2) {
    position.enPassant = { row: (move.toRow + move.fromRow) / 2, col: move.fromCol };
  }
  if (piece === "P" && move.toRow === 0) position.board[move.toRow][move.toCol] = "Q";
  if (piece === "p" && move.toRow === 7) position.board[move.toRow][move.toCol] = "q";
  position.turn = color === "w" ? "b" : "w";
  position.moves += 1;
}

function legalMovesFrom(position, row, col) {
  const piece = position.board[row][col];
  if (!piece || colorOf(piece) !== position.turn) return [];
  return pseudoMoves(position, row, col).filter((move) => {
    const nextPosition = clonePosition(position);
    applyMove(nextPosition, move);
    return !inCheck(nextPosition, colorOf(piece));
  });
}

function allLegalMoves(position, color) {
  const originalTurn = position.turn;
  position.turn = color;
  const moves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      moves.push(...legalMovesFrom(position, row, col));
    }
  }
  position.turn = originalTurn;
  return moves;
}

function clearSelection() {
  game.selected = null;
  game.legalMoves = [];
}

function selectSquare(row, col) {
  const piece = game.board[row][col];
  if (!piece || colorOf(piece) !== game.turn) {
    clearSelection();
    render();
    return;
  }
  game.selected = { row, col };
  game.legalMoves = legalMovesFrom(game, row, col);
  render();
}

function makeMove(move) {
  applyMove(game, move);
  game.lastMove = move;
  clearSelection();
  render();
}

function handleSquare(row, col) {
  if (game.selected) {
    const chosenMove = game.legalMoves.find((move) => move.toRow === row && move.toCol === col);
    if (chosenMove) {
      makeMove(chosenMove);
      return;
    }
  }
  if (game.board[row][col] && colorOf(game.board[row][col]) === game.turn) {
    game.selected = { row, col };
    game.legalMoves = legalMovesFrom(game, row, col);
    render();
  } else {
    clearSelection();
    render();
  }
}

function squareName(row, col) {
  return `${"abcdefgh"[col]}${8 - row}`;
}

function render() {
  const currentCheck = inCheck(game, game.turn);
  const possibleMoves = allLegalMoves(game, game.turn);
  const gameOver = possibleMoves.length === 0;
  const sideName = game.turn === "w" ? "White" : "Black";
  boardElement.replaceChildren();

  for (let row = 0; row < 8; row += 1) {
    const tableRow = document.createElement("tr");
    for (let col = 0; col < 8; col += 1) {
      const square = document.createElement("td");
      const piece = game.board[row][col];
      const targetMove = game.legalMoves.find((move) => move.toRow === row && move.toCol === col);
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.row = row;
      square.dataset.col = col;
      square.tabIndex = 0;
      square.setAttribute("role", "button");
      square.setAttribute("aria-label", `${squareName(row, col)}${piece ? ` ${piece.toLowerCase()}${colorOf(piece) === "w" ? " white" : " black"}` : " empty"}`);
      if (game.selected && game.selected.row === row && game.selected.col === col) square.classList.add("selected");
      if (targetMove) square.classList.add(game.board[row][col] || targetMove.enPassant ? "legal-capture" : "legal-move");
      if (currentCheck && piece === (game.turn === "w" ? "K" : "k")) square.classList.add("in-check");
      if (game.lastMove && (
        (game.lastMove.fromRow === row && game.lastMove.fromCol === col)
        || (game.lastMove.toRow === row && game.lastMove.toCol === col)
      )) square.classList.add("last-move");

      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${colorOf(piece) === "w" ? "white" : "black"}`;
        pieceElement.textContent = pieceSymbols[piece];
        pieceElement.draggable = colorOf(piece) === game.turn && !gameOver;
        square.append(pieceElement);
      }
      tableRow.append(square);
    }
    boardElement.append(tableRow);
  }

  turnStatus.textContent = gameOver ? "Game over" : `${sideName} to move${currentCheck ? " - check" : ""}`;
  positionStatus.textContent = gameOver
    ? (currentCheck ? `${sideName === "White" ? "Black" : "White"} wins by checkmate` : "Draw by stalemate")
    : currentCheck ? "King in check" : game.moves ? "Game in progress" : "Opening setup";
  moveCount.textContent = String(Math.ceil(game.moves / 2));
  gameMessage.textContent = gameOver
    ? (currentCheck ? "Checkmate! Start a new game to play again." : "Stalemate. Start a new game to play again.")
    : currentCheck
      ? `${sideName} is in check. Make a legal move to protect the king.`
      : "Select a piece and then a highlighted square, or drag it to its destination. Pawns promote to a queen.";
}

boardElement.addEventListener("click", (event) => {
  const square = event.target.closest(".square");
  if (square) handleSquare(Number(square.dataset.row), Number(square.dataset.col));
});

boardElement.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const square = event.target.closest(".square");
  if (!square) return;
  event.preventDefault();
  handleSquare(Number(square.dataset.row), Number(square.dataset.col));
});

boardElement.addEventListener("dragstart", (event) => {
  const square = event.target.closest(".square");
  if (!square) return;
  const row = Number(square.dataset.row);
  const col = Number(square.dataset.col);
  if (!game.board[row][col] || colorOf(game.board[row][col]) !== game.turn) {
    event.preventDefault();
    return;
  }
  selectSquare(row, col);
  event.dataTransfer.setData("text/plain", `${row},${col}`);
  event.dataTransfer.effectAllowed = "move";
});

boardElement.addEventListener("dragover", (event) => {
  if (event.target.closest(".square")) event.preventDefault();
});

boardElement.addEventListener("drop", (event) => {
  const square = event.target.closest(".square");
  if (!square) return;
  event.preventDefault();
  const [fromRow, fromCol] = event.dataTransfer.getData("text/plain").split(",").map(Number);
  const toRow = Number(square.dataset.row);
  const toCol = Number(square.dataset.col);
  const move = legalMovesFrom(game, fromRow, fromCol)
    .find((candidate) => candidate.toRow === toRow && candidate.toCol === toCol);
  if (move) makeMove(move);
});

document.getElementById("reset-game").addEventListener("click", () => {
  game = initialPosition();
  render();
});

render();
