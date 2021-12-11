import { ChipSet } from "./chipSets";

/**
 * Tileの一つを表すデータ。
 * [0]にチップセット番号、[1]にチップセット内のタイル番号が入る
 */
export type TileCell = [number, number];

export interface TileExParameterObject extends g.CacheableEParameterObject {
	/**
	 * タイルのデータ。
	 * チップセットとマップチップのインデックスの配列。
	 */
	tileData: TileCell[][];

	/**
	 * 描画に利用するチップセット。
	 *
	 * この値を変更した場合、 `this.invalidate()` が呼び出される必要がある。
	 */
	chipSets: ChipSet[];

	/**
	 * マップチップが描画される領域。
	 *
	 * 設定された場合、指定された領域外にあるマップチップは再描画されない。
	 * 画面外にあたるなどの、不要なマップチップの再描画をしないことで、描画を最適化するために利用できる。
	 * この値を変更した場合、 `this.invalidate()` が呼び出される必要がある。
	 * 初期値は `undefined` 。
	 */
	redrawArea?: g.CommonArea | null | undefined;

	/**
	 * マップチップ一つの幅。
	 * ChipSetの幅と異なる場合、ChipSetは右合わせで描画される。
	 * この値を変更した場合、 `this.invalidate()` が呼び出される必要がある。
	 */
	tileWidth: number;

	/**
	 * マップチップ一つの幅。
	 * ChipSetの幅と異なる場合、ChipSetは下合わせで描画される。
	 * この値を変更した場合、 `this.invalidate()` が呼び出される必要がある。
	 */
	tileHeight: number;
}

export class TileExRenderer {
	tile: TileEx;
	dx: number;
	dy: number;
	x: number;
	y: number;
	renderer: g.Renderer;
	drawnTileData: TileCell[][];
	chipSetIndex: number;
	chipIndex: number;

	constructor(
		tile: TileEx,
		renderer: g.Renderer,
		drawnTileData: TileCell[][]
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
			return false;
		}

		const chipSet = this.tile.chipSets[this.chipSetIndex];
		if (chipSet == null) {
			throw new Error("Invalid chipset");
		}

		this.chipIndex = tile[1];
		if (this.chipIndex < 0) {
			return false;
		}

		if (this.drawnTileData[y] !== undefined) {
			if (
				this.drawnTileData[y][x][0] === this.chipSetIndex &&
				this.drawnTileData[y][x][1] === this.chipIndex
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
		chipSet.render(this);
		this.drawnTileData[y][x] = [tile[0], tile[1]];

		return true;
	}
}

export class TileEx extends g.CacheableE {
	chipSets: ChipSet[];

	tileData: TileCell[][];

	_drawnTileData: TileCell[][];

	tileWidth: number;
	tileHeight: number;
	redrawArea: g.CommonArea | null | undefined;

	constructor(params: TileExParameterObject) {
		super(params);
		this.chipSets = params.chipSets;
		this.tileData = params.tileData;
		this._drawnTileData = undefined;
		this.tileWidth = params.tileWidth;
		this.tileHeight = params.tileHeight;
		this.redrawArea = params.redrawArea;
		this.height = this.tileHeight * this.tileData.length;
		this.width = this.tileWidth * this.tileData[0].length;
	}

	// akashic-tileから丸ぱくり
	renderSelf(renderer: g.Renderer, camera?: g.Camera): boolean {
		if (this._renderedCamera !== camera) {
			this.state &= ~g.EntityStateFlags.Cached;
			this._renderedCamera = camera;
		}
		if (!(this.state & g.EntityStateFlags.Cached)) {
			var isNew =
				!this._cache ||
				this._cache.width < Math.ceil(this.width) ||
				this._cache.height < Math.ceil(this.height);
			if (isNew) {
				if (this._cache && !this._cache.destroyed()) {
					this._cache.destroy();
				}
				this._cache = this.scene.game.resourceFactory.createSurface(
					Math.ceil(this.width),
					Math.ceil(this.height)
				);
				this._renderer = this._cache.renderer();

				this._drawnTileData = [];
				for (var y = 0; y < this.tileData.length; ++y) {
					this._drawnTileData[y] = [];
					for (var x = 0; x < this.tileData[y].length; ++x) {
						this._drawnTileData[y][x] = [-1, -1];
					}
				}
			}
			this._renderer.begin();

			// `CacheableE#renderSelf()` ではここで `this._renderer.clear()` を呼び出すが、
			// `Tile` は `this._cache` の描画状態を再利用するので `this._renderer.clear()` を呼び出す必要はない。

			this.renderCache(this._renderer);

			this.state |= g.EntityStateFlags.Cached;
			this._renderer.end();
		}
		if (this._cache && this.width > 0 && this.height > 0) {
			renderer.drawImage(
				this._cache,
				0,
				0,
				this.width,
				this.height,
				0,
				0
			);
		}
		return this._shouldRenderChildren;
	}

	renderCache(renderer: g.Renderer): void {
		if (!this.tileData)
			throw g.ExceptionFactory.createAssertionError(
				"TileEx#_renderCache: don't have a tile data"
			);
		renderer.save();
		renderer.clear();
		renderer.setCompositeOperation("source-over");

		const tileRenderer = new TileExRenderer(
			this,
			renderer,
			this._drawnTileData
		);

		for (let y = 0; y < this.tileData.length; ++y) {
			const row = this.tileData[y];
			for (let x = 0; x < row.length; ++x) {
				tileRenderer.render(x, y);
			}
		}
		renderer.restore();
	}

	destroy(destroySurface?: boolean): void {
		if (destroySurface && this.chipSets) {
			this.chipSets.forEach((chipSet) => {
				if (!chipSet.destroyed()) {
					chipSet.destroy();
				}
			});
		}
		this.chipSets = undefined;
		this.tileData = undefined;
		this._drawnTileData = undefined;
		this.redrawArea = undefined;
		super.destroy();
	}
}
