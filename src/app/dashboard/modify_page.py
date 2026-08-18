import os

page_file = r'c:\Users\guill\OneDrive\Documentos\GitHub\obrasaas\src\app\dashboard\page.js'
with open(page_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Insert import at line 8
lines.insert(8, "import AdminPanel from './components/AdminPanel';\n")

# Need to offset the indices because we inserted 1 line
# Original range was 2123 (idx 2122) to 2627 (idx 2627 exclusive)
# With 1 line added, the indices become 2123 to 2628
start_idx = 2122 + 1
end_idx = 2627 + 1

new_lines = lines[:start_idx] + [
    "          <AdminPanel \n",
    "            state={state}\n",
    "            setState={setState}\n",
    "            activeTab={activeTab}\n",
    "            addToast={addToast}\n",
    "            simulateBillingCycle={simulateBillingCycle}\n",
    "            billingCycleRunning={billingCycleRunning}\n",
    "            mrrChartRef={mrrChartRef}\n",
    "            crmMessages={crmMessages}\n",
    "            crmMessagesEndRef={crmMessagesEndRef}\n",
    "            crmInput={crmInput}\n",
    "            setCrmInput={setCrmInput}\n",
    "            sendCrmUserMessage={sendCrmUserMessage}\n",
    "            handleApproveProposal={handleApproveProposal}\n",
    "            handleNotifySupplier={handleNotifySupplier}\n",
    "            handleConfirmSupplier={handleConfirmSupplier}\n",
    "            setShowReceiveMaterialModal={setShowReceiveMaterialModal}\n",
    "            handleCertifyQuincena={handleCertifyQuincena}\n",
    "            showBillingLogs={showBillingLogs}\n",
    "            billingLogs={billingLogs}\n",
    "          />\n"
] + lines[end_idx:]

with open(page_file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
