// Barrel that re-exports the order-related mutations from their split
// submodules. Kept so existing callsites can continue importing from
// `@/features/orders/mutations` without churn.

export {
  type CreateOrderLineInput,
  snapshotFromProduct,
} from "./mutation-helpers";

export {
  uploadCustomerPo,
  deleteOrderAttachment,
  createOrder,
  updateOrder,
  advanceOrderStatus,
  cancelOrder,
  updateOrderProformaMetadata,
  setOrderOfferNumber,
  setOrderProposalPdfPath,
} from "./order-mutations";

export {
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
} from "./order-line-mutations";

export {
  assignOrderToShipment,
  unassignOrderFromShipment,
} from "./order-shipment-mutations";
