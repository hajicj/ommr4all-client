export class ViewSettings {
  constructor(
    public showStaffLines = true,
    public showStaffGroupShading = false,
    public showLayout = true,
    public showSymbols = false,
    public showBoundingBoxes = true,
  ) {
  }

  copy(): ViewSettings {
    return Object.assign({}, this) as ViewSettings;
  }
}