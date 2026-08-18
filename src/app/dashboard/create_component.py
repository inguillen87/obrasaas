import os

page_file = r'c:\Users\guill\OneDrive\Documentos\GitHub\obrasaas\src\app\dashboard\page.js'
with open(page_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# lines 2123 to 2627 are indices 2122 to 2627 (exclusive)
content = "".join(lines[2122:2627])

component = f"""\"use client\";

export default function AdminPanel({{
  state,
  setState,
  activeTab,
  addToast,
  simulateBillingCycle,
  billingCycleRunning,
  mrrChartRef,
  crmMessages,
  crmMessagesEndRef,
  crmInput,
  setCrmInput,
  sendCrmUserMessage,
  handleApproveProposal,
  handleNotifySupplier,
  handleConfirmSupplier,
  setShowReceiveMaterialModal,
  handleCertifyQuincena,
  showBillingLogs,
  billingLogs
}}) {{
  return (
{content}  );
}}
"""

component_file = r'c:\Users\guill\OneDrive\Documentos\GitHub\obrasaas\src\app\dashboard\components\AdminPanel.js'
os.makedirs(os.path.dirname(component_file), exist_ok=True)
with open(component_file, 'w', encoding='utf-8') as f:
    f.write(component)
