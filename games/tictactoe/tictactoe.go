package main

import "errors"

const (
	EMPTY = iota
	X
	O
)

type Board struct {
	// list of clients, first player is X, second player is O
	clients [2]*Client
	state   [3][3]uint8
}

type Move struct {
	row uint8
	col uint8
}

// creates a new initial board
func newBoard(p1 *Client, p2 *Client) *Board {
	return &Board{
		clients: [2]*Client{p1, p2},
		state: [3][3]uint8{
			{EMPTY, EMPTY, EMPTY},
			{EMPTY, EMPTY, EMPTY},
			{EMPTY, EMPTY, EMPTY},
		},
	}
}

// does move validation, return an error if any problems happen
// modifies board when making the move and returns nil
func makeMove(plr *Client, board *Board, move Move) error {
	// validate move
	// is player a part of board?
	plrIdx := -1
	for curIdx, v := range board.clients {
		if plr == v {
			plrIdx = curIdx
			break
		}
	}
	if plrIdx == -1 {
		return errors.New("Player not a part of game")
	}

	// is it the player's move?
	playerXMoveCount := 0
	playerOMoveCount := 0
	for _, row := range board.state {
		for _, value := range row {
			if value == X {
				playerXMoveCount = playerXMoveCount + 1
			} else if value == O {
				playerOMoveCount = playerOMoveCount + 1
			}
		}
	}
	var nextPlayerMove *Client
	var moveValue uint8
	if playerXMoveCount == playerOMoveCount {
		nextPlayerMove = board.clients[0]
		moveValue = X
	} else {
		nextPlayerMove = board.clients[1]
		moveValue = O
	}
	if plr != nextPlayerMove {
		return errors.New("It is not this player's turn to move")
	}

	// check if the move is valid
	if !(move.row >= 0 && move.row < 3 && move.col >= 0 && move.col < 3) {
		return errors.New("Invalid move location: Out of range")
	}
	if board.state[move.row][move.col] != EMPTY {
		return errors.New("Invalid move location: Someone already moved here")
	}

	// make the move
	board.state[move.row][move.col] = moveValue
	return nil
}

// checks if board game is over
func isEndGame(board *Board) bool {
	for i := 0; i < 3; i++ {
		if board.state[i][0] != EMPTY && board.state[i][0] == board.state[i][1] && board.state[i][1] == board.state[i][2] {
			return true
		}
		if board.state[0][i] != EMPTY && board.state[0][i] == board.state[1][i] && board.state[1][i] == board.state[2][i] {
			return true
		}
	}
	if board.state[0][0] == EMPTY && board.state[0][0] == board.state[1][1] && board.state[1][1] == board.state[2][2] {
		return true
	}
	if board.state[0][2] == EMPTY && board.state[1][1] == board.state[0][2] && board.state[1][1] == board.state[2][0] {
		return true
	}
	return false
}
