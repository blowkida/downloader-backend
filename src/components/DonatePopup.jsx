import React from 'react'

export default function DonatePopup({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full relative">
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold text-orange-600 mb-4">Support SS YouTube</h2>
        <p className="text-gray-600 mb-4">
          If you find this tool helpful, please consider supporting us with a small donation.
          Your contribution helps keep our servers running and enables us to continue providing this service for free.
        </p>
        <div className="flex flex-col gap-3 mb-4">
          <button className="bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600">
            Donate with PayPal
          </button>
          <button className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600">
            Donate with Credit Card
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Thank you for your support! ❤️
        </p>
      </div>
    </div>
  )
}
