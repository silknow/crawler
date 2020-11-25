class Record {
  constructor(id, url) {
    this.id = id || '';
    this.url = url || '';
    this.fields = [];
    this.images = [];

    if (typeof id === 'object') {
      Object.assign(this, id);
    }
  }

  addField(label, value) {
    const field = this.getFieldByLabel(label);
    if (!field) {
      this.fields.push({
        label,
        [Array.isArray(value) ? 'values' : 'value']: value
      });
    } else {
      if (typeof field.value !== 'undefined') {
        field.values = [field.value];
        delete field.value;
      }
      if (!Array.isArray(field.values)) {
        field.values = [field.values].filter(f => f);
      }
      field.values.push(...(Array.isArray(value) ? value : [value]));
    }
  }

  addImage(image) {
    if (!image) {
      return false;
    }
    // Do not add duplicates
    if (image.url && this.images.some(img => img.url === image.url)) {
      return false;
    }
    this.images.push(image);
    return true;
  }

  getImages() {
    return this.images;
  }

  getFieldByLabel(label) {
    return this.fields.find(f => f.label === label);
  }

  getFields() {
    return this.fields;
  }

  getId() {
    return this.id;
  }

  getUrl() {
    return this.url;
  }
}

module.exports = Record;
