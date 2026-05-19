export type MandoubCashState = {
  error?: string;
  ok?: boolean;
  deletedEventId?: string;
  deletedMode?: "soft" | "hard";
};

export type MandoubEditCustomerState = {
  error?: string;
  ok?: boolean;
  flash?: "cleared" | "saved";
};

export type UploadDoorPhotoState = {
  error?: string;
  ok?: boolean;
};

export type UploadCustomerDoorState = {
  error?: string;
};

export type MandoubBulkStatusState = {
  error?: string;
  ok?: boolean;
};

export type RevertShopDoorPhotoState = {
  error?: string;
  ok?: boolean;
};
