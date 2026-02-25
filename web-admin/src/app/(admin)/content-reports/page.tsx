'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getContentReports, 
  getContentReportStatistics, 
  reviewContentReport,
  GetContentReportsParams,
  ContentReport,
  ReviewReportRequest
} from '@/lib/api/admin/content-reports';
import { Flag, Filter, Eye, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export default function ContentReportsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState<GetContentReportsParams>({
    status: undefined,
    contentType: undefined,
    reason: undefined,
  });
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'reviewed' | 'resolved' | 'rejected'>('reviewed');
  const [reviewNote, setReviewNote] = useState('');
  const queryClient = useQueryClient();

  const params: GetContentReportsParams = {
    page,
    pageSize,
    ...filters,
  };

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['content-reports', params],
    queryFn: () => getContentReports(params),
  });

  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['content-report-statistics'],
    queryFn: () => getContentReportStatistics(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, request }: { id: string; request: ReviewReportRequest }) => 
      reviewContentReport(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-reports'] });
      queryClient.invalidateQueries({ queryKey: ['content-report-statistics'] });
      setReviewModalOpen(false);
      setSelectedReport(null);
      setReviewNote('');
    },
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      resolved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    };
    const labels = {
      pending: 'Beklemede',
      reviewed: 'İncelendi',
      resolved: 'Çözüldü',
      rejected: 'Reddedildi',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, { en: string; tr: string }> = {
      spam: { en: 'Spam', tr: 'Spam' },
      inappropriate: { en: 'Inappropriate Content', tr: 'Uygunsuz İçerik' },
      hate_speech: { en: 'Hate Speech', tr: 'Nefret Söylemi' },
      copyright: { en: 'Copyright Violation', tr: 'Telif Hakkı İhlali' },
      fake_account: { en: 'Fake Account', tr: 'Sahte Hesap' },
      other: { en: 'Other', tr: 'Diğer' },
    };
    return labels[reason]?.tr || reason;
  };

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      product: 'Ürün',
      user: 'Kullanıcı',
      comment: 'Yorum',
    };
    return labels[type] || type;
  };

  const handleReview = () => {
    if (!selectedReport) return;
    reviewMutation.mutate({
      id: selectedReport.id,
      request: {
        status: reviewStatus,
        adminNote: reviewNote.trim() || undefined,
      },
    });
  };

  const clearFilters = () => {
    setFilters({
      status: undefined,
      contentType: undefined,
      reason: undefined,
    });
    setPage(1);
  };

  const hasActiveFilters = filters.status || filters.contentType || filters.reason;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Flag className="h-6 w-6 text-orange-500" />
            İçerik Şikayetleri
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kullanıcıların şikayet ettiği içerikleri yönetin
          </p>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Toplam</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{statistics.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Beklemede
            </div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{statistics.pending}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Eye className="h-4 w-4" />
              İncelendi
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{statistics.reviewed}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Çözüldü
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{statistics.resolved}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              Reddedildi
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{statistics.rejected}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtreler:</span>
          </div>
          
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Tüm Durumlar</option>
            <option value="pending">Beklemede</option>
            <option value="reviewed">İncelendi</option>
            <option value="resolved">Çözüldü</option>
            <option value="rejected">Reddedildi</option>
          </select>

          <select
            value={filters.contentType || ''}
            onChange={(e) => setFilters({ ...filters, contentType: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Tüm İçerik Tipleri</option>
            <option value="product">Ürün</option>
            <option value="user">Kullanıcı</option>
            <option value="comment">Yorum</option>
          </select>

          <select
            value={filters.reason || ''}
            onChange={(e) => setFilters({ ...filters, reason: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Tüm Sebepler</option>
            <option value="spam">Spam</option>
            <option value="inappropriate">Uygunsuz İçerik</option>
            <option value="hate_speech">Nefret Söylemi</option>
            <option value="copyright">Telif Hakkı İhlali</option>
            <option value="fake_account">Sahte Hesap</option>
            <option value="other">Diğer</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {reportsLoading ? (
          <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
        ) : !reportsData?.items.length ? (
          <div className="p-8 text-center text-gray-500">Şikayet bulunamadı</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Şikayet Eden
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İçerik Tipi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Sebep
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {reportsData.items.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {report.reporter?.username || report.reporter?.email || report.reporterUserId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {getContentTypeLabel(report.contentType)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {getReasonLabel(report.reason)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(report.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setReviewModalOpen(true);
                            setReviewStatus(report.status === 'pending' ? 'reviewed' : report.status as any);
                            setReviewNote(report.adminNote || '');
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                        >
                          <Eye className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {reportsData.total > pageSize && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Toplam {reportsData.total} şikayet, sayfa {page} / {Math.ceil(reportsData.total / pageSize)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Önceki
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(reportsData.total / pageSize), p + 1))}
                    disabled={page >= Math.ceil(reportsData.total / pageSize)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Modal */}
      {reviewModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Şikayet Detayı
              </h2>
              <button
                onClick={() => {
                  setReviewModalOpen(false);
                  setSelectedReport(null);
                  setReviewNote('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Report Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Şikayet Eden</label>
                  <div className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedReport.reporter?.username || selectedReport.reporter?.email || selectedReport.reporterUserId}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">İçerik Tipi</label>
                  <div className="mt-1 text-sm text-gray-900 dark:text-white">
                    {getContentTypeLabel(selectedReport.contentType)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Sebep</label>
                  <div className="mt-1 text-sm text-gray-900 dark:text-white">
                    {getReasonLabel(selectedReport.reason)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Durum</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedReport.status)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tarih</label>
                  <div className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedReport.createdAt)}
                  </div>
                </div>
                {selectedReport.reviewedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Değerlendirme Tarihi</label>
                    <div className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(selectedReport.reviewedAt)}
                    </div>
                  </div>
                )}
              </div>

              {/* Content Info */}
              {selectedReport.content && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">İçerik Bilgisi</label>
                  <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                    <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {JSON.stringify(selectedReport.content, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedReport.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Açıklama</label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md text-sm text-gray-900 dark:text-white">
                    {selectedReport.description}
                  </div>
                </div>
              )}

              {/* Admin Note */}
              {selectedReport.adminNote && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Admin Notu</label>
                  <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-gray-900 dark:text-white">
                    {selectedReport.adminNote}
                  </div>
                </div>
              )}

              {/* Review Form */}
              {selectedReport.status === 'pending' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Değerlendirme Durumu
                    </label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="reviewed">İncelendi</option>
                      <option value="resolved">Çözüldü</option>
                      <option value="rejected">Reddedildi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Admin Notu (Opsiyonel)
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Değerlendirme notu ekleyebilirsiniz..."
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setReviewModalOpen(false);
                        setSelectedReport(null);
                        setReviewNote('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleReview}
                      disabled={reviewMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reviewMutation.isPending ? 'Kaydediliyor...' : 'Değerlendir'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
