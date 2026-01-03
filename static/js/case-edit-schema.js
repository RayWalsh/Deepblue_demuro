window.CASE_EDIT_SCHEMA = {
  general: {
    title: "General",
    fields: [
      { key: "ClientName", label: "Client", type: "text" },
      { key: "VesselName", label: "Vessel", type: "text" },
      { key: "VoyageNumber", label: "Voyage Number", type: "text" },
      { key: "CharterersName", label: "Charterer", type: "text" },
      { key: "OwnersName", label: "Owners", type: "text" },
      { key: "BrokersName", label: "Broker", type: "text" },
      { key: "ContactName", label: "Contact", type: "text" },
      { key: "CPDate", label: "CP Date", type: "date" },
      { key: "VoyageEndDate", label: "Voyage End Date", type: "date" }
    ]
  },

  charterparty: {
    title: "Charterparty",
    fields: [
      { key: "CPType", label: "CP Type", type: "text" },
      { key: "CPForm", label: "CP Form", type: "text" },
      { key: "ContractType", label: "Contract Type", type: "text" },
      { key: "Layday", label: "Layday", type: "date" },
      { key: "Cancelling", label: "Cancelling", type: "date" },
      { key: "Reversible", label: "Reversible", type: "boolean" },
      { key: "CalculationType", label: "Calculation Type", type: "text" }
    ]
  },

  claim: {
    title: "Claim Info",
    fields: [
      { key: "ClaimFiled", label: "Claim Submitted Date", type: "date" },
      { key: "ClaimReceived", label: "Claim Received", type: "date" },
      { key: "InitialClaim", label: "Initial Claim", type: "number" },
      { key: "ClaimFiledAmount", label: "Claim Filed Amount", type: "number" },
      { key: "ClaimStatus", label: "Claim Status", type: "text" },
      { key: "ClaimType", label: "Claim Type", type: "text" },
      { key: "ClaimNotes", label: "Claim Notes", type: "text" }
    ]
  },

  rates: {
    title: "Laytime & Rates",
    fields: [
      { key: "LoadingRate", label: "Loading Rate", type: "number" },
      { key: "DischargingRate", label: "Discharging Rate", type: "number" },
      { key: "DemurrageRate", label: "Demurrage Rate", type: "number" },
      { key: "LumpsumHours", label: "Lumpsum Hours", type: "number" }
    ]
  }
};