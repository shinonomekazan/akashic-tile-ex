import { TileExRenderer } from "./TileExRenderer";

export interface ChipSetParameterObject {
	/**
	 * マップチップ画像。
	 */
	src: g.Surface | g.ImageAsset;
	/**
	 * マップチップ一つの幅。
	 */
	tileWidth: number;
	/**
	 * マップチップ一つの高さ。
	 */
	tileHeight: number;
}

export class ChipSet {
	/**
	 * マップチップ画像。
	 * この値を変更した場合、 `this.invalidate()` が呼び出される必要がある。
	 */
	chips: g.Surface;

	/**
	 * マップチップ一つの幅。
	 * この値を変更した場合、 `this.invalidate()` が呼び出される必要がある。
	 */
	chipWidth: number;

	/**
	 * マップチップ一つの高さ。
	 * この値を変更した場合、 `this.invalidate()` が呼び出される必要がある。
	 */
	chipHeight: number;

	_chipsInRow: number;

	constructor(param: ChipSetParameterObject) {
		this.chips = g.SurfaceUtil.asSurface(param.src);
		this.chipWidth = param.tileWidth;
		this.chipHeight = param.tileHeight;
		this.invalidate();
	}

	render(tileRenderer: TileExRenderer): void {
		// setCompositeOperation は外部で設定される必要がある点に注意
		const tileX =
			this.chipWidth * (tileRenderer.chipIndex % this._chipsInRow);
		const tileY =
			this.chipHeight *
			Math.floor(tileRenderer.chipIndex / this._chipsInRow);

		tileRenderer.renderer.drawImage(
			this.chips,
			tileX,
			tileY,
			this.chipWidth,
			this.chipHeight,
			tileRenderer.dx,
			tileRenderer.dy
		);
	}

	destroy(destroySurface?: boolean): void {
		if (destroySurface && this.chips && !this.chips.destroyed()) {
			this.chips.destroy();
		}
		this.chips = undefined;
	}

	destroyed() {
		return this.chips == null;
	}

	invalidate(): void {
		this._chipsInRow = Math.floor(this.chips.width / this.chipWidth);
	}
}

export interface WolfAutoTileChipSetParameterObject
	extends ChipSetParameterObject {
	// Note: 何かあれば
}

export class WolfAutoTileChipSet extends ChipSet {
	constructor(params: WolfAutoTileChipSetParameterObject) {
		super(params);
	}

	render(tileRenderer: TileExRenderer): void {
		const tw2 = Math.floor(this.chipWidth / 2);
		const th2 = Math.floor(this.chipHeight / 2);
		const chip = tileRenderer.chipIndex;
		for (let i = 0; i < 2; ++i) {
			for (let j = 0; j < 2; ++j) {
				const nx = tileRenderer.x + (i === 0 ? -1 : 1);
				const ny = tileRenderer.y + (j === 0 ? -1 : 1);
				const nearTiles = [
					tileRenderer.getChip(tileRenderer.x, ny),
					tileRenderer.getChip(nx, tileRenderer.y),
					tileRenderer.getChip(nx, ny),
				];
				let offset = 0;
				// ウディタの仕様では、オートタイルは必ず同一種なので、chipSetIndexが同一なら同一と判定
				// アニメーションがずれると壊れてしまうが、呼び出し元で担保してもらうようにする
				if (
					nearTiles[0] != null &&
					nearTiles[0][0] === tileRenderer.chipSetIndex &&
					nearTiles[0][1] >= 0
					// nearTiles[0][0] === tileRenderer.chipSetIndex &&
					// nearTiles[0][1] === chip
				) {
					offset += 1;
				}
				if (
					nearTiles[1] != null &&
					nearTiles[1][0] === tileRenderer.chipSetIndex &&
					nearTiles[1][1] >= 0
					// nearTiles[1][0] === tileRenderer.chipSetIndex &&
					// nearTiles[1][1] === chip
				) {
					offset += 2;
				}
				if (
					nearTiles[2] != null &&
					nearTiles[2][0] === tileRenderer.chipSetIndex &&
					nearTiles[2][1] >= 0 &&
					// nearTiles[2][1] === chip &&
					offset === 3
				) {
					offset += 1;
				}

				// 通常のタイル仕様だとこうだが、ウディタのアニメーションタイルのために5固定にする
				// const tileX = this.tileWidth * ((tile + offset) % this._tilesInRow) + i * tw2;
				// const tileY = this.tileHeight * Math.floor((tile + offset) / this._tilesInRow) + j * th2;
				const tileX =
					this.chipWidth * Math.floor((chip + offset) / 5) + i * tw2;
				const tileY = this.chipHeight * ((chip + offset) % 5) + j * th2;

				tileRenderer.renderer.drawImage(
					this.chips,
					tileX,
					tileY,
					tw2,
					th2,
					tileRenderer.dx + i * tw2,
					tileRenderer.dy + j * th2
				);
			}
		}
	}
}
