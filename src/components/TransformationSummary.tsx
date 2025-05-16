
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryData } from "@/utils/excelUtils";
import { Progress } from "@/components/ui/progress";

interface TransformationSummaryProps {
  summaryData: SummaryData;
}

const TransformationSummary: React.FC<TransformationSummaryProps> = ({ summaryData }) => {
  const { totalTransactions, encaissements, decaissements } = summaryData;
  const encaissementPercent = Math.round((encaissements.count / totalTransactions) * 100);
  const decaissementPercent = Math.round((decaissements.count / totalTransactions) * 100);

  // Format monetary values
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Card className="w-full animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2 text-blue-600" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
            <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
          </svg>
          Résumé des transactions
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
              <span className="text-blue-700 font-medium">✓</span>
            </div>
            <div>
              <p className="text-sm font-medium">Total Transactions</p>
              <p className="text-2xl font-bold">{totalTransactions}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium flex items-center">
                <span className="text-blue-600 mr-1">📥</span> Encaissements
              </p>
              <div className="flex items-baseline">
                <p className="text-xl font-bold">{encaissements.count}</p>
                <p className="text-sm text-gray-500 ml-2">
                  {formatCurrency(encaissements.total)}
                </p>
              </div>
            </div>
            <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
              {encaissementPercent}%
            </div>
          </div>
          
          <Progress value={encaissementPercent} className="h-2" />
          
          <div className="bg-gray-50 rounded-md p-3 mt-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Détails par compte:</p>
            <div className="space-y-1">
              {Object.entries(encaissements.details).map(([compte, value]) => (
                <div key={compte} className="flex justify-between text-sm">
                  <span>💰 Compte {compte}:</span>
                  <div className="font-medium flex flex-col items-end">
                    <span>{value.count} transactions</span>
                    <span className="text-xs text-gray-600">{formatCurrency(value.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium flex items-center">
                <span className="text-blue-600 mr-1">📤</span> Décaissements
              </p>
              <div className="flex items-baseline">
                <p className="text-xl font-bold">{decaissements.count}</p>
                <p className="text-sm text-gray-500 ml-2">
                  {formatCurrency(decaissements.total)}
                </p>
              </div>
            </div>
            <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
              {decaissementPercent}%
            </div>
          </div>
          
          <Progress value={decaissementPercent} className="h-2" />
          
          <div className="grid gap-2 grid-cols-1 md:grid-cols-3 mt-3">
            <Card className="bg-gray-50 border-0">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">Salaires</p>
                  <div className="text-right">
                    <span className="text-sm font-bold">{decaissements.salaires.count}</span>
                    <p className="text-xs text-gray-600">{formatCurrency(decaissements.salaires.amount)}</p>
                  </div>
                </div>
                <Progress 
                  value={decaissements.salaires.count > 0 ? (decaissements.salaires.count / decaissements.count) * 100 : 0} 
                  className="h-1" 
                />
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50 border-0">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">Achats directs</p>
                  <div className="text-right">
                    <span className="text-sm font-bold">{decaissements.achatsDirects.count}</span>
                    <p className="text-xs text-gray-600">{formatCurrency(decaissements.achatsDirects.amount)}</p>
                  </div>
                </div>
                <Progress 
                  value={decaissements.achatsDirects.count > 0 ? (decaissements.achatsDirects.count / decaissements.count) * 100 : 0} 
                  className="h-1" 
                />
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50 border-0">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">Achats indirects</p>
                  <div className="text-right">
                    <span className="text-sm font-bold">{decaissements.achatsIndirects.count}</span>
                    <p className="text-xs text-gray-600">{formatCurrency(decaissements.achatsIndirects.amount)}</p>
                  </div>
                </div>
                <Progress 
                  value={decaissements.achatsIndirects.count > 0 ? (decaissements.achatsIndirects.count / decaissements.count) * 100 : 0} 
                  className="h-1" 
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TransformationSummary;
