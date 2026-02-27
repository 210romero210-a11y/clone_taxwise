export const F1040_2025_Page1 = {
  form: '1040_2025_Page1',
  template_url: '/templates/f1040_2025.pdf',
  dimensions: { width: 612, height: 792 },
  mappings: [
    {
      id: '1040_Line1a',
      field_name: 'TaxpayerFirstName',
      coordinates: { x: 75, y: 665 },
      type: 'text',
      max_length: 25,
      style: { color: 'black', fontSize: 10 }
    },
    {
      id: '1040_Line1b',
      field_name: 'TaxpayerLastName',
      coordinates: { x: 310, y: 665 },
      type: 'text',
      max_length: 35
    },
    {
      id: '1040_LineSSN',
      field_name: 'TaxpayerSSN',
      coordinates: { x: 485, y: 665 },
      type: 'numeric',
      format: '000-00-0000'
    },
    {
      id: '1040_FilingStatus_Single',
      field_name: 'FS_Single',
      coordinates: { x: 58, y: 692 },
      type: 'checkbox',
      mark: 'X'
    },
    {
      id: '1040_Line1z',
      field_name: 'TotalWages',
      coordinates: { x: 505, y: 420 },
      type: 'currency',
      is_calculated: true,
      source: 'W2.box1',
      taxwise_state: { can_override: true, override_key: 'F8' }
    }
  ]
};

export const InvoiceTemplate = {
  form: 'Invoice',
  template_url: '/templates/invoice.pdf',
  dimensions: { width: 612, height: 792 },
  mappings: [
    { id: 'INV_ClientName', field_name: 'TaxpayerName', coordinates: { x: 75, y: 700 }, type: 'text' },
    { id: 'INV_Fee', field_name: 'taxPreparationFee', coordinates: { x: 450, y: 500 }, type: 'currency' },
    { id: 'INV_Date', field_name: 'preparedDate', coordinates: { x: 75, y: 680 }, type: 'text' }
  ]
};

export default { F1040_2025_Page1, InvoiceTemplate };
