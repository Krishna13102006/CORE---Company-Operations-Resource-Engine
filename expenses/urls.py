from django.urls import path
from . import views

urlpatterns = [
    path('scan-receipt/',                 views.ReceiptScanView.as_view()),
    path('scan-receipt-batch/',           views.BatchReceiptScanView.as_view()),
    path('exchange-rates/',               views.ExchangeRatesView.as_view()),
    path('policy-check/',                 views.PolicyCheckView.as_view()),
    path('project-costs/',                views.ProjectCostProfitabilityView.as_view()),
    path('budgets/',                      views.SpendBudgetView.as_view()),
    path('budgets/<uuid:budget_id>/',     views.SpendBudgetDetailView.as_view()),
    path('subscription-radar/',           views.SubscriptionRadarView.as_view()),
    path('export-payout/',                views.BankPayoutExportView.as_view()),
    path('batch-approve/',                views.ExpenseBatchApproveView.as_view()),
    path('analyze-sheet/',                views.SpreadsheetAnalyzeView.as_view()),
    path('query-sheet/',                  views.SpreadsheetQueryView.as_view()),
    path('batch-payout/',                 views.ExpenseBatchPayoutView.as_view()),
    path('my-summary/',                   views.ExpenseMySummaryView.as_view()),
    path('analytics/',                    views.ExpenseAnalyticsView.as_view()),
    path('export-csv/',                   views.ExpenseExportCSVView.as_view()),
    path('',                              views.ExpenseListView.as_view()),
    path('<uuid:expense_id>/',            views.ExpenseDetailView.as_view()),
    path('<uuid:expense_id>/approve/',    views.ExpenseApproveView.as_view()),
    path('<uuid:expense_id>/reject/',     views.ExpenseRejectView.as_view()),
    path('<uuid:expense_id>/reimburse/',  views.ExpenseReimburseView.as_view()),
]
