"use client";

import { useState } from "react";
import { ethers } from "ethers";
// ⚠️ Đảm bảo bạn đã copy file JSON ABI vào đúng đường dẫn này
import TOKEN_BRIDGE from "../abi/TokenBridge.json";

// Địa chỉ Contract Bridge bạn đã deploy thành công
const TOKEN_BRIDGE_CONTRACT_ADDRESS =
  "0x6a7EDD974851055367763B92fec281d118E54e90";

// ABI tối giản của ERC20 chỉ để gọi hàm approve
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

export function useBridge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any>(null);

  const bridgeTokens = async ({
    token,
    symbol,
    amount,
    destChainId,
  }: {
    token: string;
    symbol: string;
    amount: string;
    destChainId: number;
  }) => {
    try {
      setLoading(true);
      setError(null);
      setReceipt(null);

      if (!window.ethereum) throw new Error("No crypto wallet found!");

      // 1. Kết nối ví
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 2. Chuẩn bị dữ liệu
      const amountParsed = ethers.parseUnits(amount, 18); // Giả sử token 18 decimals
      const recipient = await signer.getAddress();
      const destChain = ethers.toUtf8Bytes(`EVM-${destChainId}`);

      // 3. --- QUAN TRỌNG: APPROVE TOKEN ---
      // Tạo instance của Token USD.h để gọi hàm approve
      const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);

      console.log("Checking allowance...");
      // (Optional) Có thể check allowance trước để đỡ tốn gas approve lại, nhưng để đơn giản ta approve luôn
      console.log("Approving token...");
      const approveTx = await tokenContract.approve(
        TOKEN_BRIDGE_CONTRACT_ADDRESS,
        amountParsed,
      );
      await approveTx.wait(); // Bắt buộc chờ Approve thành công
      console.log("Approve confirmed!");

      // 4. --- GỌI HÀM BRIDGE ---
      const bridgeContract = new ethers.Contract(
        TOKEN_BRIDGE_CONTRACT_ADDRESS,
        TOKEN_BRIDGE.abi, // Đảm bảo file JSON có trường .abi, nếu không thì bỏ .abi đi
        signer,
      );

      console.log("Bridging tokens...");
      const tx = await bridgeContract.bridgeTokens(
        token,
        symbol,
        amountParsed,
        recipient,
        destChain,
        { value: 0 }, // Nếu bridge token ERC20 thì value = 0 (trừ khi cần trả phí native)
      );

      console.log("Tx Sent:", tx.hash);
      const txReceipt = await tx.wait();
      setReceipt(txReceipt);

      return txReceipt;
    } catch (err: any) {
      console.error("Bridge Error:", err);
      // Lấy message lỗi rõ ràng hơn từ Ethers
      const errorMessage =
        err.reason || err.message || "Unknown error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { bridgeTokens, loading, error, receipt };
}
