import { ChipSet } from "./chipSets";
import { TileExRenderer } from "./TileExRenderer";

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

export class TileEx extends g.CacheableE {
	chipSets: ChipSet[];

	tileData: TileCell[][];

	_drawnTileData: number[][];

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
						this._drawnTileData[y][x] = -1;
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

	/**
	 * 対象個所のチップを切り替える。
	 * @param y Y座標
	 * @param x X座標
	 * @param chip チップ番号
	 */
	setChip(y: number, x: number, chip: number) {
		this.tileData[y][x][1] = chip;
	}

	/**
	 * 対象個所のチップセットを切り替える。
	 * チップセットは本メソッド経由で切り替えないとinvalidateを呼んでも更新されない点に注意。
	 * @param y Y座標
	 * @param x X座標
	 * @param chipSetIndex チップセットのindex
	 */
	setChipSet(y: number, x: number, chipSetIndex: number) {
		this.tileData[y][x][0] = chipSetIndex;
		this._drawnTileData[y][x] = -1;
	}

	/**
	 * 対象個所のチップを切り替え、周辺を再描画する。
	 * オートタイルの場合、本メソッド経由で更新しないと正しく反映されない点に注意。
	 * @param y Y座標
	 * @param x X座標
	 * @param chip チップ番号
	 */
	setChipWithNear(y: number, x: number, chip: number) {
		this.tileData[y][x][1] = chip;
		for (let i = y - 1; i <= y + 1; i++) {
			if (i < 0) continue;
			if (i >= this.tileData.length) continue;
			for (let j = x - 1; j <= x + 1; j++) {
				if (j < 0) continue;
				if (j >= this.tileData[i].length) continue;
				this._drawnTileData[i][j] = -1;
			}
		}
	}

	renderCache(renderer: g.Renderer): void {
		if (!this.tileData)
			throw g.ExceptionFactory.createAssertionError(
				"TileEx#_renderCache: don't have a tile data"
			);
		renderer.save();

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

	/**
	 * 全タイルを強制的に再描画した上で、invalidateを呼び出す。
	 */
	fullInvalidate() {
		for (var y = 0; y < this.tileData.length; ++y) {
			for (var x = 0; x < this.tileData[y].length; ++x) {
				this._drawnTileData[y][x] = -1;
			}
		}
		this.invalidate();
	}
}
