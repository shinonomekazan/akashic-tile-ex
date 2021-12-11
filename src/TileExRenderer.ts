import { TileEx, TileCell } from "./TileEx";

export class TileExRenderer {
	tile: TileEx;
	dx: number;
	dy: number;
	x: number;
	y: number;
	renderer: g.Renderer;
	drawnTileData: number[][];
	chipSetIndex: number;
	chipIndex: number;

	constructor(
		tile: TileEx,
		renderer: g.Renderer,
		drawnTileData: number[][]
	) {
		this.tile = tile;
		this.renderer = renderer;
		this.drawnTileData = drawnTileData;

		this.dx = -1;
		this.dy = -1;
		this.x = -1;
		this.y = -1;
		this.chipIndex = -1;
		this.chipSetIndex = -1;
	}

	getChip(x: number, y: number): TileCell | null {
		if (x < 0 || y < 0) return null;
		if (y >= this.tile.tileData.length) return null;
		if (x >= this.tile.tileData[y].length) return null;
		return this.tile.tileData[y][x];
	}

	render(x: number, y: number) {
		this.x = x;
		this.y = y;
		const tile = this.tile.tileData[y][x];
		if (tile == null) {
			return false;
		}

		this.chipSetIndex = tile[0];
		if (this.chipSetIndex < 0) {
			// Note: chipSetが見つからない場合はクリアする場所も不明なのでエラーにする
			throw new Error("Invalid chipset");
		}

		const chipSet = this.tile.chipSets[this.chipSetIndex];
		if (chipSet == null) {
			throw new Error("Invalid chipset");
		}

		this.chipIndex = tile[1];
		if (this.drawnTileData[y] !== undefined) {
			if (
				this.drawnTileData[y][x] === this.chipIndex
			) {
				return false;
			}
		}

		let dx = this.tile.tileWidth * x;
		let dy = this.tile.tileHeight * y;
		if (
			chipSet.chipWidth !== this.tile.tileWidth ||
			chipSet.chipHeight !== this.tile.tileHeight
		) {
			dx -= chipSet.chipWidth - this.tile.tileWidth;
			dy -= chipSet.chipHeight - this.tile.tileHeight;
		}

		if (this.tile.redrawArea) {
			if (
				dx + chipSet.chipWidth < this.tile.redrawArea.x ||
				dx >= this.tile.redrawArea.x + this.tile.redrawArea.width ||
				dy + chipSet.chipHeight < this.tile.redrawArea.y ||
				dy >= this.tile.redrawArea.y + this.tile.redrawArea.height
			) {
				return false;
			}
		}

		this.dx = dx;
		this.dy = dy;
		this.renderer.setCompositeOperation("destination-out");
		this.renderer.fillRect(
			dx,
			dy,
			chipSet.chipWidth,
			chipSet.chipHeight,
			"white"
		); // DestinationOutなので色はなんでも可
		if (this.chipIndex >= 0) {
			this.renderer.setCompositeOperation("source-over");
			chipSet.render(this);
		}
		this.drawnTileData[y][x] = this.chipIndex;

		return true;
	}
}
