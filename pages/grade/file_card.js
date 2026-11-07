// pages/grade/file_card.js
Component({
  properties: {
    file: {
      type: Object,
      value: {}
    },
    isAdmin: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    handlePreview() {
      this.triggerEvent('preview', this.data.file);
    },

    handleDelete() {
      this.triggerEvent('delete', this.data.file);
    }
  }
});