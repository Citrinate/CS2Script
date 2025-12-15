import Popup from '@components/popup.js';
import { CreateElement } from '@utils/helpers.js';

export default class Table {
	_data;
	_filteredData;

	#rowElements = [];
	#lastStartRow;
	_sortColumns = null;
	_sortDirection = null;
	#defaultSort;

	static #ROW_HEIGHT = 69;
	static #BUFFER_ROWS = 3;
	#VISIBLE_ROWS;
	get #NUM_ROW_ELEMENTS() { return this.#VISIBLE_ROWS + Table.#BUFFER_ROWS * 2; };

	#popup;

	_tableContainerElement;
	#tableElement;
	#tableBodyElement;
	#spacerElement;

	static SORT_DIRECTION = {
		ASC: 0,
		DESC: 1
	};

	constructor() {
		this.#VISIBLE_ROWS = Math.max(1, Math.floor((unsafeWindow.innerHeight * .66) / Table.#ROW_HEIGHT));
	}

	_CreateTable(tableData, tableHeaderElement, tableFooterElement, options) {
		this._data = tableData;
		this._filteredData = tableData;

		this.#defaultSort = options.defaultSort ?? null;

		// Reset all row elements created by another table
		this._data.map(item => delete item.element);

		this.#tableBodyElement = CreateElement("tbody");

		this.#spacerElement = CreateElement("div");

		this.#tableElement = CreateElement("table", {
			class: "cs2s_table",
			children: [
				tableHeaderElement,
				this.#tableBodyElement,
				this.#spacerElement
			]
		});

		this._tableContainerElement = CreateElement("div", {
			class: "cs2s_table_container",
			style: {
				height: `${(this.#VISIBLE_ROWS + 1) * Table.#ROW_HEIGHT}px`
			},
			onscroll: () => { this.#UpdateRows(); },
			children: [this.#tableElement]
		});

		this.#popup = new Popup({
			title: options.popupTitle,
			titleChildren: options.popupTitleChildren,
			body: [this._tableContainerElement, tableFooterElement],
			onclose: options.popupOnClose
		});
	}

	Show() {
		this.#popup.Show();
		this._FilterRows();
		this._UpdateTable();
		this._tableContainerElement.focus();

		// Lock column widths so they don't jump around when filtering
		this._tableContainerElement.style.width = `${this._tableContainerElement.offsetWidth}px`;
		this._tableContainerElement.querySelectorAll('thead th').forEach(th => {
			th.style.width = getComputedStyle(th).width;
		});
	}

	_GetRowElement(_item) { 
		throw new Error("Subclasses must implement _GetRowElement");
	}

	_UpdateTable() {
		this.#lastStartRow = Number.POSITIVE_INFINITY;

		for (let i = 0; i < this.#rowElements.length; i++) {
			this.#rowElements[i].remove();
		}

		this.#rowElements = [];

		for (let i = 0; i < this.#NUM_ROW_ELEMENTS; i++) {
			if (i >= this._filteredData.length) {
				break;
			}

			const rowElement = this._GetRowElement(this._filteredData[i]);
			this.#rowElements.push(rowElement);
			this.#tableBodyElement.append(rowElement);
		}

		this.#spacerElement.style.height = "0px"
		this.#spacerElement.style.height = `${(this._filteredData.length * Table.#ROW_HEIGHT) - this.#tableElement.clientHeight + 31}px`;

		this.#UpdateRows();
		this._UpdateFooter();
	}

	#UpdateRows() {
		const startRow = Math.max(
			0,
			Math.min(
				this._filteredData.length - this.#NUM_ROW_ELEMENTS,
				Math.floor(this._tableContainerElement.scrollTop / Table.#ROW_HEIGHT) - Table.#BUFFER_ROWS
			)
		);

		if (startRow == this.#lastStartRow) {
			return;
		}

		const diff = Math.max(
			-this.#NUM_ROW_ELEMENTS,
			Math.min(
				this.#NUM_ROW_ELEMENTS,
				startRow - this.#lastStartRow
			)
		);

		this.#lastStartRow = startRow;

		if (diff > 0) {
			// Scrolling down
			for (let i = 0; i < diff; i++) {
				const dataIndex = startRow + this.#NUM_ROW_ELEMENTS - diff + i;

				if (dataIndex >= this._filteredData.length || dataIndex < 0) {
					continue;
				}

				// Delete a rendered row from the top
				const oldRow = this.#rowElements.shift();
				oldRow.remove();

				// Render a new row at the bottom
				const newRow = this._GetRowElement(this._filteredData[dataIndex]);
				this.#rowElements.push(newRow);
				this.#tableBodyElement.append(newRow);
			}
		} else {
			// Scrolling up
			for (let i = 0; i < Math.abs(diff); i++) {
				const dataIndex = startRow - diff - i - 1;

				if (dataIndex >= this._filteredData.length || dataIndex < 0) {
					continue;
				}

				// Delete a rendered row from the bottom
				const oldRow = this.#rowElements.pop();
				oldRow.remove();

				// Render a new row at the top
				const newRow = this._GetRowElement(this._filteredData[dataIndex]);
				this.#rowElements.unshift(newRow);
				this.#tableBodyElement.prepend(newRow);
			}
		}

		this.#tableBodyElement.style.transform = `translate3d(0, ${startRow * Table.#ROW_HEIGHT}px, 0)`;
	}

	_UpdateFooter() {
		throw new Error("Subclasses must implement _UpdateFooter");
	}

	_SortRows(options = {}) {
		if (this._data.length == 0) {
			return;
		}

		if (options.columns) {
			if (this._sortDirection != null && this._sortColumns[0] != options.columns[0]) {
				this._sortDirection = null;
			}

			this._sortColumns = options.columns;
		}

		let resetSort = false;

		if (options.event) {
			if (this._sortDirection === Table.SORT_DIRECTION.DESC) {
				// Reset sort on 3rd click
				if (this.#defaultSort) {
					this._sortColumns = this.#defaultSort.columns;
					this._sortDirection = this.#defaultSort.direction;
					resetSort = true;
				} else {
					this._sortDirection = Table.SORT_DIRECTION.ASC;
				}
			} else if (this._sortDirection === Table.SORT_DIRECTION.ASC) {
				this._sortDirection = Table.SORT_DIRECTION.DESC;
			}
		}

		if (!this._sortColumns) {
			return;
		}

		if (!this._sortDirection) {
			this._sortDirection = Table.SORT_DIRECTION.ASC;
		}

		const asc = this._sortDirection === Table.SORT_DIRECTION.ASC;

		this._filteredData.sort((a, b) => {
			for (const column of this._sortColumns) {
				let valueA = a[column];
				let valueB = b[column];

				if (valueA === valueB) {
					continue;
				}

				if (typeof valueA === "undefined") {
					return 1;
				}

				if (typeof valueB === "undefined") {
					return -1;
				}

				if (typeof valueA === "string") {
					return asc ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
				}

				return asc ? valueA - valueB : valueB - valueA;
			}

			return 0;
		});

		if (options.event) {
			this._tableContainerElement.querySelectorAll('.cs2s_table_column_sort_asc').forEach(el => { el.classList.remove('cs2s_table_column_sort_asc'); });
			this._tableContainerElement.querySelectorAll('.cs2s_table_column_sort_desc').forEach(el => { el.classList.remove('cs2s_table_column_sort_desc'); });

			if (!resetSort) {
				if (asc) {
					options.event.currentTarget.querySelector(".cs2s_table_column_sort").classList.add("cs2s_table_column_sort_asc");
				} else {
					options.event.currentTarget.querySelector(".cs2s_table_column_sort").classList.add("cs2s_table_column_sort_desc");
				}
			}
		}

		this._UpdateTable();
	}

	_FilterRow(_item) { 
		throw new Error("Subclasses must implement _Filter");
	}

	_FilterRows() {
		if (this._data.length == 0) {
			return;
		}

		this._filteredData = this._data.filter(this._FilterRow.bind(this));
		this._tableContainerElement.scrollTop = 0;
		this._SortRows();
		this._UpdateTable();
	}
}
